/**
 * Runtime-based Completion Provider
 *
 * Provides autocompletion by inspecting the live JavaScript runtime scope.
 * Unlike static LSP, this sees actual variable values and their types.
 */

import type {
  CompletionResult,
  CompletionItem,
  CompletionType,
  SandboxWindow,
} from '../types';

/**
 * JavaScript keywords for completion
 */
const JS_KEYWORDS = [
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
];

/**
 * Common global functions/objects to suggest
 */
const COMMON_GLOBALS = [
  { label: 'console', type: 'variable' as const, detail: 'Console' },
  { label: 'fetch', type: 'function' as const, detail: '(url, options?) => Promise<Response>' },
  { label: 'setTimeout', type: 'function' as const, detail: '(fn, ms) => number' },
  { label: 'setInterval', type: 'function' as const, detail: '(fn, ms) => number' },
  { label: 'clearTimeout', type: 'function' as const, detail: '(id) => void' },
  { label: 'clearInterval', type: 'function' as const, detail: '(id) => void' },
  { label: 'JSON', type: 'variable' as const, detail: 'JSON' },
  { label: 'Math', type: 'variable' as const, detail: 'Math' },
  { label: 'Array', type: 'class' as const, detail: 'Array constructor' },
  { label: 'Object', type: 'class' as const, detail: 'Object constructor' },
  { label: 'Promise', type: 'class' as const, detail: 'Promise constructor' },
  { label: 'Map', type: 'class' as const, detail: 'Map constructor' },
  { label: 'Set', type: 'class' as const, detail: 'Set constructor' },
  { label: 'Date', type: 'class' as const, detail: 'Date constructor' },
  { label: 'RegExp', type: 'class' as const, detail: 'RegExp constructor' },
];

/**
 * Get the completion type based on a value
 */
function getCompletionType(value: unknown): CompletionType {
  if (typeof value === 'function') {
    if (/^class\s/.test(value.toString())) {
      return 'class';
    }
    return 'function';
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return 'variable';
    }
    return 'variable';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return 'constant';
  }
  return 'variable';
}

/**
 * Get a short type description for a value
 */
function getTypeDescription(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'function') {
    const fn = value as Function;
    const name = fn.name || 'anonymous';
    const source = fn.toString();

    // Check if it's a class
    if (/^class\s/.test(source)) {
      return `class ${name}`;
    }

    // Try to extract parameter list
    const paramMatch = source.match(/^(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/);
    const params = paramMatch ? paramMatch[1].trim() : '...';
    return `(${params}) => ...`;
  }

  if (type === 'object') {
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    const constructor = (value as object).constructor?.name;
    if (constructor && constructor !== 'Object') {
      return constructor;
    }
    const keys = Object.keys(value as object);
    if (keys.length <= 3) {
      return `{ ${keys.join(', ')} }`;
    }
    return `{ ${keys.slice(0, 3).join(', ')}, ... }`;
  }

  if (type === 'string') {
    const str = value as string;
    if (str.length > 30) {
      return `"${str.slice(0, 27)}..."`;
    }
    return `"${str}"`;
  }

  if (type === 'number' || type === 'boolean') {
    return String(value);
  }

  return type;
}

/**
 * Parse code to find what's being completed
 */
export interface CompletionContext {
  /** The word/identifier being typed */
  word: string;
  /** Position where the word starts */
  wordStart: number;
  /** Object being accessed (for property completion) */
  object?: string;
  /** Whether this is a property access (after .) */
  isPropertyAccess: boolean;
  /** Whether this is a method call context (after .) */
  isMethodAccess: boolean;
}

/**
 * Parse the completion context from code and cursor position
 */
export function parseCompletionContext(
  code: string,
  cursorPos: number
): CompletionContext {
  // Get the text before cursor
  const beforeCursor = code.slice(0, cursorPos);

  // Find the current word being typed
  const wordMatch = beforeCursor.match(/([a-zA-Z_$][\w$]*)$/);
  const word = wordMatch ? wordMatch[1] : '';
  const wordStart = cursorPos - word.length;

  // Check for property access: something.word
  const propertyMatch = beforeCursor.match(/([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.\s*([a-zA-Z_$][\w$]*)?$/);

  if (propertyMatch) {
    return {
      word: propertyMatch[2] || '',
      wordStart: cursorPos - (propertyMatch[2]?.length || 0),
      object: propertyMatch[1],
      isPropertyAccess: true,
      isMethodAccess: false,
    };
  }

  // Check for method chain after ().: something().word
  const methodChainMatch = beforeCursor.match(/\)\.\s*([a-zA-Z_$][\w$]*)?$/);
  if (methodChainMatch) {
    return {
      word: methodChainMatch[1] || '',
      wordStart: cursorPos - (methodChainMatch[1]?.length || 0),
      isPropertyAccess: true,
      isMethodAccess: true,
    };
  }

  return {
    word,
    wordStart,
    isPropertyAccess: false,
    isMethodAccess: false,
  };
}

/**
 * Get completions from the runtime scope
 */
export function getCompletions(
  code: string,
  cursorPos: number,
  ctx: SandboxWindow | null,
  userVars: Record<string, unknown>
): CompletionResult {
  const context = parseCompletionContext(code, cursorPos);
  const items: CompletionItem[] = [];

  if (context.isPropertyAccess && context.object && ctx) {
    // Property completion: object.xxx
    try {
      // Evaluate the object to get its value
      const objValue = ctx.eval(context.object);

      if (objValue !== null && objValue !== undefined) {
        // Get own properties
        const ownProps = Object.getOwnPropertyNames(objValue);
        for (const prop of ownProps) {
          if (prop.startsWith(context.word)) {
            try {
              const value = (objValue as Record<string, unknown>)[prop];
              items.push({
                label: prop,
                type: typeof value === 'function' ? 'method' : 'property',
                detail: getTypeDescription(value),
              });
            } catch {
              items.push({
                label: prop,
                type: 'property',
              });
            }
          }
        }

        // Get prototype methods
        const proto = Object.getPrototypeOf(objValue);
        if (proto) {
          const protoProps = Object.getOwnPropertyNames(proto);
          for (const prop of protoProps) {
            if (
              prop.startsWith(context.word) &&
              prop !== 'constructor' &&
              !items.some((i) => i.label === prop)
            ) {
              try {
                const value = proto[prop];
                if (typeof value === 'function') {
                  items.push({
                    label: prop,
                    type: 'method',
                    detail: getTypeDescription(value),
                  });
                }
              } catch {
                // Skip
              }
            }
          }
        }
      }
    } catch {
      // Object evaluation failed, can't provide completions
    }
  } else if (context.isMethodAccess) {
    // After ()., suggest common return type methods
    // This is harder without type info - suggest array methods as common case
    const arrayMethods = ['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'slice', 'concat', 'join'];
    for (const method of arrayMethods) {
      if (method.startsWith(context.word)) {
        items.push({
          label: method,
          type: 'method',
          detail: 'Array method',
        });
      }
    }
  } else {
    // Top-level completion
    const word = context.word.toLowerCase();

    // Add user-defined variables first (highest priority)
    for (const [name, value] of Object.entries(userVars)) {
      if (name.toLowerCase().startsWith(word)) {
        items.push({
          label: name,
          type: getCompletionType(value),
          detail: getTypeDescription(value),
        });
      }
    }

    // Add common globals
    for (const global of COMMON_GLOBALS) {
      if (global.label.toLowerCase().startsWith(word)) {
        if (!items.some((i) => i.label === global.label)) {
          items.push(global);
        }
      }
    }

    // Add keywords
    for (const keyword of JS_KEYWORDS) {
      if (keyword.startsWith(word)) {
        items.push({
          label: keyword,
          type: 'keyword',
        });
      }
    }
  }

  // Sort: user vars first, then by label
  items.sort((a, b) => {
    // User-defined variables first
    const aIsUser = a.label in userVars;
    const bIsUser = b.label in userVars;
    if (aIsUser && !bIsUser) return -1;
    if (!aIsUser && bIsUser) return 1;

    // Then alphabetically
    return a.label.localeCompare(b.label);
  });

  return {
    items: items.slice(0, 50), // Limit results
    from: context.wordStart,
    to: cursorPos,
  };
}
