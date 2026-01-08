/**
 * Code Completion
 *
 * Provides runtime-aware code completions by introspecting live values
 * in the execution context.
 *
 * @module lsp/complete
 */

import {
  parseCompletionContext,
  splitObjectPath,
  isKeyword,
  getKeywords,
  getCommonGlobals,
} from './parse.js';

import {
  formatValueShort,
  getTypeName,
  getCompletionKind,
  getFunctionSignature,
} from './format.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/completion.js').CompletionResult} CompletionResult
 * @typedef {import('../types/completion.js').CompletionItem} CompletionItem
 * @typedef {import('../types/completion.js').CompleteOptions} CompleteOptions
 */

/**
 * Get completions at cursor position
 *
 * @param {string} code - The code being edited
 * @param {number} cursor - Cursor position (0-indexed)
 * @param {ExecutionContext} context - Execution context for live values
 * @param {CompleteOptions} [options]
 * @returns {CompletionResult}
 */
export function getCompletions(code, cursor, context, options = {}) {
  const ctx = parseCompletionContext(code, cursor);

  // Don't complete inside strings or comments
  if (ctx.type === 'string' || ctx.type === 'comment') {
    return {
      matches: [],
      cursorStart: cursor,
      cursorEnd: cursor,
      source: 'runtime',
    };
  }

  /** @type {CompletionItem[]} */
  let matches = [];

  switch (ctx.type) {
    case 'member':
      matches = getMemberCompletions(ctx.object || '', ctx.prefix, context);
      break;

    case 'bracket':
      matches = getBracketCompletions(ctx.object || '', context);
      break;

    case 'global':
    default:
      matches = getGlobalCompletions(ctx.prefix, context);
      break;
  }

  // Filter by prefix
  if (ctx.prefix) {
    const lowerPrefix = ctx.prefix.toLowerCase();
    matches = matches.filter(item =>
      item.label.toLowerCase().startsWith(lowerPrefix)
    );
  }

  // Sort by priority and name
  matches.sort((a, b) => {
    const priorityDiff = (a.sortPriority ?? 50) - (b.sortPriority ?? 50);
    if (priorityDiff !== 0) return priorityDiff;
    return a.label.localeCompare(b.label);
  });

  return {
    matches,
    cursorStart: ctx.start,
    cursorEnd: ctx.end,
    source: 'runtime',
  };
}

/**
 * Get completions for member access (dot notation)
 * @param {string} objectPath
 * @param {string} prefix
 * @param {ExecutionContext} context
 * @returns {CompletionItem[]}
 */
function getMemberCompletions(objectPath, prefix, context) {
  if (!objectPath) return [];

  // Resolve the object in context
  const value = resolveValue(objectPath, context);
  if (value === undefined && !objectPath.includes('.')) {
    // Check if it's a global
    const global = context.getGlobal();
    if (global && objectPath in global) {
      // @ts-ignore
      return getPropertiesOf(global[objectPath]);
    }
  }

  if (value === undefined || value === null) {
    return [];
  }

  return getPropertiesOf(value);
}

/**
 * Get completions for bracket access
 * @param {string} objectPath
 * @param {ExecutionContext} context
 * @returns {CompletionItem[]}
 */
function getBracketCompletions(objectPath, context) {
  const value = resolveValue(objectPath, context);

  if (Array.isArray(value)) {
    // Suggest indices
    return value.slice(0, 20).map((_, i) => ({
      label: String(i),
      kind: /** @type {const} */ ('value'),
      detail: getTypeName(value[i]),
      valuePreview: formatValueShort(value[i]),
      sortPriority: 10,
    }));
  }

  if (value instanceof Map) {
    // Suggest keys
    return Array.from(value.keys()).slice(0, 20).map(key => ({
      label: String(key),
      insertText: typeof key === 'string' ? `"${key}"` : String(key),
      kind: /** @type {const} */ ('property'),
      detail: getTypeName(value.get(key)),
      valuePreview: formatValueShort(value.get(key)),
      sortPriority: 10,
    }));
  }

  if (typeof value === 'object' && value !== null) {
    // Suggest string keys
    return Object.keys(value).slice(0, 50).map(key => ({
      label: key,
      insertText: `"${key}"`,
      kind: /** @type {const} */ ('property'),
      detail: getTypeName(value[key]),
      valuePreview: formatValueShort(value[key]),
      sortPriority: 10,
    }));
  }

  return [];
}

/**
 * Get completions for global context
 * @param {string} prefix
 * @param {ExecutionContext} context
 * @returns {CompletionItem[]}
 */
function getGlobalCompletions(prefix, context) {
  /** @type {CompletionItem[]} */
  const items = [];

  // 1. User-defined variables (highest priority)
  const userVars = context.getVariables();
  for (const [name, value] of Object.entries(userVars)) {
    items.push({
      label: name,
      kind: getCompletionKind(value),
      detail: getTypeName(value),
      valuePreview: formatValueShort(value),
      type: getTypeName(value),
      sortPriority: 10,
    });
  }

  // 2. Keywords
  for (const keyword of getKeywords()) {
    items.push({
      label: keyword,
      kind: 'keyword',
      sortPriority: 60,
    });
  }

  // 3. Common globals
  const global = context.getGlobal();
  for (const name of getCommonGlobals()) {
    if (name in userVars) continue; // Skip if user defined

    try {
      // @ts-ignore
      const value = global?.[name];
      if (value !== undefined) {
        items.push({
          label: name,
          kind: getCompletionKind(value),
          detail: getTypeName(value),
          type: getTypeName(value),
          sortPriority: 40,
        });
      }
    } catch {
      // Skip inaccessible
    }
  }

  // 4. Add some built-in globals that might be useful
  const builtinGlobals = ['globalThis', 'window', 'document', 'navigator', 'location'];
  for (const name of builtinGlobals) {
    if (name in userVars) continue;
    try {
      // @ts-ignore
      const value = global?.[name];
      if (value !== undefined) {
        items.push({
          label: name,
          kind: 'variable',
          detail: getTypeName(value),
          sortPriority: 50,
        });
      }
    } catch {
      // Skip inaccessible
    }
  }

  return items;
}

/**
 * Get all properties of an object as completion items
 * @param {*} value
 * @returns {CompletionItem[]}
 */
function getPropertiesOf(value) {
  /** @type {CompletionItem[]} */
  const items = [];
  const seen = new Set();

  // Walk prototype chain
  let obj = value;
  let depth = 0;

  while (obj != null && depth < 5) {
    const names = Object.getOwnPropertyNames(obj);

    for (const name of names) {
      if (seen.has(name)) continue;
      if (name === 'constructor') continue; // Skip constructor
      seen.add(name);

      try {
        const descriptor = Object.getOwnPropertyDescriptor(obj, name);
        const propValue = descriptor?.get ? undefined : value[name];

        /** @type {CompletionItem} */
        const item = {
          label: name,
          kind: typeof propValue === 'function' ? 'method' : 'property',
          sortPriority: depth === 0 ? 20 : 30 + depth,
        };

        if (propValue !== undefined) {
          item.detail = getTypeName(propValue);
          item.type = getTypeName(propValue);

          if (typeof propValue === 'function') {
            item.detail = getFunctionSignature(propValue);
          } else {
            item.valuePreview = formatValueShort(propValue);
          }
        } else if (descriptor?.get) {
          item.detail = '(getter)';
        }

        items.push(item);
      } catch {
        // Skip inaccessible properties
        items.push({
          label: name,
          kind: 'property',
          detail: '(inaccessible)',
          sortPriority: 90,
        });
      }
    }

    obj = Object.getPrototypeOf(obj);
    depth++;
  }

  return items;
}

/**
 * Resolve a value from an object path in the context
 * @param {string} path
 * @param {ExecutionContext} context
 * @returns {*}
 */
function resolveValue(path, context) {
  const parts = splitObjectPath(path);
  if (parts.length === 0) return undefined;

  // Start with user variables or global
  let value = context.getVariable(parts[0]);

  if (value === undefined) {
    // Try global
    const global = context.getGlobal();
    if (global && parts[0] in global) {
      // @ts-ignore
      value = global[parts[0]];
    }
  }

  if (value === undefined) return undefined;

  // Navigate path
  for (let i = 1; i < parts.length; i++) {
    if (value === null || value === undefined) return undefined;

    try {
      if (value instanceof Map) {
        value = value.get(parts[i]);
      } else {
        // @ts-ignore
        value = value[parts[i]];
      }
    } catch {
      return undefined;
    }
  }

  return value;
}
