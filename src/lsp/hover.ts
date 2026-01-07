/**
 * Runtime-based Hover Provider
 *
 * Provides hover information by inspecting actual runtime values.
 * Shows real values, types, and function signatures.
 */

import type { HoverResult, SandboxWindow } from '../types';

/**
 * Maximum length for value previews
 */
const MAX_VALUE_LENGTH = 500;
const MAX_ARRAY_PREVIEW = 10;
const MAX_OBJECT_KEYS = 10;

/**
 * Parse an identifier from code at a given position
 */
export function parseIdentifierAtPosition(
  code: string,
  cursorPos: number
): { name: string; start: number; end: number } | null {
  // Expand selection to find the full identifier/property chain
  let start = cursorPos;
  let end = cursorPos;

  // Find start of identifier
  while (start > 0) {
    const char = code[start - 1];
    if (/[\w$.]/.test(char)) {
      start--;
    } else {
      break;
    }
  }

  // Find end of identifier
  while (end < code.length) {
    const char = code[end];
    if (/[\w$]/.test(char)) {
      end++;
    } else {
      break;
    }
  }

  // Clean up leading dots
  while (code[start] === '.' && start < end) {
    start++;
  }

  const name = code.slice(start, end);
  if (!name || !/^[a-zA-Z_$][\w$.]*$/.test(name)) {
    return null;
  }

  return { name, start, end };
}

/**
 * Get type information for a value
 */
function getTypeInfo(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'function') {
    const fn = value as Function;
    const source = fn.toString();

    // Check if it's a class
    if (/^class\s/.test(source)) {
      return `class ${fn.name || 'anonymous'}`;
    }

    // Check if it's an async function
    if (/^async\s/.test(source)) {
      return `async function ${fn.name || 'anonymous'}`;
    }

    return `function ${fn.name || 'anonymous'}`;
  }

  if (type === 'object') {
    if (Array.isArray(value)) {
      const itemType = value.length > 0 ? typeof value[0] : 'unknown';
      return `Array<${itemType}> (length: ${value.length})`;
    }

    const constructor = (value as object).constructor?.name;
    if (constructor && constructor !== 'Object') {
      return constructor;
    }

    return 'object';
  }

  return type;
}

/**
 * Get a function's signature
 */
function getFunctionSignature(fn: Function): string {
  const source = fn.toString();

  // Extract parameters
  const paramMatch = source.match(/^(?:async\s+)?(?:function\s*)?(?:\w*\s*)?\(([^)]*)\)/);
  const params = paramMatch ? paramMatch[1].trim() : '';

  // Detect arrow function
  const isArrow = /^(?:async\s+)?\([^)]*\)\s*=>/.test(source) ||
    /^(?:async\s+)?[a-zA-Z_$][\w$]*\s*=>/.test(source);

  // Detect class
  if (/^class\s/.test(source)) {
    // Try to find constructor
    const ctorMatch = source.match(/constructor\s*\(([^)]*)\)/);
    const ctorParams = ctorMatch ? ctorMatch[1].trim() : '';
    return `class ${fn.name || 'anonymous'}${ctorParams ? `(${ctorParams})` : ''}`;
  }

  const asyncPrefix = /^async\s/.test(source) ? 'async ' : '';

  if (isArrow) {
    return `${asyncPrefix}(${params}) => ...`;
  }

  return `${asyncPrefix}function ${fn.name || 'anonymous'}(${params})`;
}

/**
 * Format a value for preview
 */
function formatValuePreview(value: unknown, depth = 0, maxDepth = 2): string {
  if (depth > maxDepth) {
    return '...';
  }

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string') {
    const str = value as string;
    if (str.length > 100) {
      return `"${str.slice(0, 97)}..."`;
    }
    return `"${str}"`;
  }

  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return String(value);
  }

  if (type === 'symbol') {
    return (value as symbol).toString();
  }

  if (type === 'function') {
    return getFunctionSignature(value as Function);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (depth >= maxDepth) return `Array(${value.length})`;

    const preview = value
      .slice(0, MAX_ARRAY_PREVIEW)
      .map((v) => formatValuePreview(v, depth + 1, maxDepth))
      .join(', ');

    const suffix = value.length > MAX_ARRAY_PREVIEW ? ', ...' : '';
    return `[${preview}${suffix}]`;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const constructor = obj.constructor?.name;

    // Special handling for common types
    if (constructor === 'Date') {
      return (value as Date).toISOString();
    }
    if (constructor === 'RegExp') {
      return (value as RegExp).toString();
    }
    if (constructor === 'Map') {
      const map = value as Map<unknown, unknown>;
      return `Map(${map.size})`;
    }
    if (constructor === 'Set') {
      const set = value as Set<unknown>;
      return `Set(${set.size})`;
    }
    if (constructor === 'Error') {
      const err = value as Error;
      return `${err.name}: ${err.message}`;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (depth >= maxDepth) return `{...}`;

    const preview = keys
      .slice(0, MAX_OBJECT_KEYS)
      .map((key) => {
        const val = formatValuePreview(obj[key], depth + 1, maxDepth);
        return `${key}: ${val}`;
      })
      .join(', ');

    const suffix = keys.length > MAX_OBJECT_KEYS ? ', ...' : '';
    const prefix = constructor && constructor !== 'Object' ? `${constructor} ` : '';

    return `${prefix}{ ${preview}${suffix} }`;
  }

  return String(value);
}

/**
 * Get hover information for an identifier
 */
export function getHoverInfo(
  code: string,
  cursorPos: number,
  ctx: SandboxWindow | null
): HoverResult {
  const identifier = parseIdentifierAtPosition(code, cursorPos);

  if (!identifier || !ctx) {
    return { found: false, name: '', type: '' };
  }

  try {
    // Evaluate the identifier to get its value
    const value = ctx.eval(identifier.name);

    const type = getTypeInfo(value);
    const preview = formatValuePreview(value);

    const result: HoverResult = {
      found: true,
      name: identifier.name,
      type,
    };

    // Add value preview (truncate if too long)
    if (preview.length <= MAX_VALUE_LENGTH) {
      result.value = preview;
    } else {
      result.value = preview.slice(0, MAX_VALUE_LENGTH - 3) + '...';
    }

    // Add signature for functions
    if (typeof value === 'function') {
      result.signature = getFunctionSignature(value);
    }

    return result;
  } catch (error) {
    // Variable doesn't exist or can't be evaluated
    return {
      found: false,
      name: identifier.name,
      type: '',
    };
  }
}

/**
 * Get detailed inspection of a specific object path
 * Used for drill-down in variable explorer
 */
export function inspectObjectPath(
  path: string,
  ctx: SandboxWindow | null
): Record<string, unknown> | null {
  if (!ctx) return null;

  try {
    const value = ctx.eval(path);

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'object' && typeof value !== 'function') {
      return { __value__: value };
    }

    const result: Record<string, unknown> = {};

    // Get own properties
    const ownProps = Object.getOwnPropertyNames(value);
    for (const prop of ownProps) {
      if (prop !== '__proto__') {
        try {
          const propValue = (value as Record<string, unknown>)[prop];
          result[prop] = {
            type: getTypeInfo(propValue),
            value: formatValuePreview(propValue, 0, 1),
            expandable:
              propValue !== null &&
              propValue !== undefined &&
              (typeof propValue === 'object' || typeof propValue === 'function'),
          };
        } catch {
          result[prop] = { type: 'unknown', value: '[inaccessible]' };
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}
