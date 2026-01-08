/**
 * Value Formatting Utilities
 *
 * Utilities for formatting JavaScript values for display in
 * completions, hover, and variable inspection.
 *
 * @module lsp/format
 */

/**
 * Format a value for display as a string
 * @param {*} value
 * @param {number} [maxLength=1000]
 * @returns {string | undefined}
 */
export function formatValue(value, maxLength = 1000) {
  if (value === undefined) return undefined;
  if (value === null) return 'null';

  if (typeof value === 'function') {
    const name = value.name || 'anonymous';
    return `[Function: ${name}]`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Map) {
    const preview = Array.from(value.entries())
      .slice(0, 5)
      .map(([k, v]) => `${formatValueShort(k)} => ${formatValueShort(v)}`)
      .join(', ');
    const more = value.size > 5 ? `, ... (${value.size} total)` : '';
    return `Map(${value.size}) {${preview}${more}}`;
  }

  if (value instanceof Set) {
    const preview = Array.from(value)
      .slice(0, 5)
      .map(formatValueShort)
      .join(', ');
    const more = value.size > 5 ? `, ... (${value.size} total)` : '';
    return `Set(${value.size}) {${preview}${more}}`;
  }

  if (Array.isArray(value)) {
    const preview = value.slice(0, 5).map(formatValueShort).join(', ');
    const more = value.length > 5 ? `, ... (${value.length} total)` : '';
    return `[${preview}${more}]`;
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value, null, 2);
      if (json.length > maxLength) {
        return json.slice(0, maxLength) + '...';
      }
      return json;
    } catch {
      return String(value);
    }
  }

  const str = String(value);
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + '...';
  }
  return str;
}

/**
 * Format a value for short display (single line, truncated)
 * @param {*} value
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function formatValueShort(value, maxLength = 50) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  if (typeof value === 'string') {
    const truncated = value.length > maxLength - 2
      ? value.slice(0, maxLength - 5) + '...'
      : value;
    return JSON.stringify(truncated);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'function') {
    return `ƒ ${value.name || 'anonymous'}()`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    const str = value.toString();
    return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
  }

  if (value instanceof Map) {
    return `Map(${value.size})`;
  }

  if (value instanceof Set) {
    return `Set(${value.size})`;
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message.slice(0, 30)}`;
  }

  if (typeof value === 'object') {
    const constructor = value.constructor?.name;
    if (constructor && constructor !== 'Object') {
      return constructor;
    }
    const keys = Object.keys(value);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
  }

  return String(value).slice(0, maxLength);
}

/**
 * Get type name for a value
 * @param {*} value
 * @returns {string}
 */
export function getTypeName(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'Array';
  if (value instanceof Date) return 'Date';
  if (value instanceof RegExp) return 'RegExp';
  if (value instanceof Error) return value.constructor.name;
  if (value instanceof Map) return 'Map';
  if (value instanceof Set) return 'Set';
  if (value instanceof WeakMap) return 'WeakMap';
  if (value instanceof WeakSet) return 'WeakSet';
  if (value instanceof Promise) return 'Promise';
  if (value instanceof ArrayBuffer) return 'ArrayBuffer';

  // Typed arrays
  if (ArrayBuffer.isView(value)) {
    return value.constructor.name;
  }

  const type = typeof value;
  if (type === 'object') {
    const constructor = value.constructor;
    if (constructor && constructor.name !== 'Object') {
      return constructor.name;
    }
    return 'Object';
  }

  return type;
}

/**
 * Get the kind of a value for completion icons
 * @param {*} value
 * @returns {import('../types/completion.js').CompletionKind}
 */
export function getCompletionKind(value) {
  if (value === null || value === undefined) {
    return 'value';
  }

  if (typeof value === 'function') {
    // Check if it's a class (constructor)
    if (/^class\s/.test(value.toString())) {
      return 'class';
    }
    return 'function';
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) return 'variable';
    if (value instanceof Map || value instanceof Set) return 'variable';
    return 'variable';
  }

  return 'value';
}

/**
 * Check if a value is expandable (has children)
 * @param {*} value
 * @returns {boolean}
 */
export function isExpandable(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return true;
  if (typeof value === 'function') return true;
  return false;
}

/**
 * Get function signature from a function
 * @param {Function} fn
 * @returns {string}
 */
export function getFunctionSignature(fn) {
  if (typeof fn !== 'function') return '';

  const str = fn.toString();

  // Handle arrow functions
  if (str.startsWith('(') || /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/.test(str)) {
    const match = str.match(/^(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/);
    if (match) {
      const params = match[1].startsWith('(') ? match[1] : `(${match[1]})`;
      return `${params} => ...`;
    }
  }

  // Handle regular functions
  const funcMatch = str.match(/^(?:async\s+)?function\s*([^(]*)\(([^)]*)\)/);
  if (funcMatch) {
    const name = funcMatch[1].trim() || fn.name || 'anonymous';
    const params = funcMatch[2];
    return `function ${name}(${params})`;
  }

  // Handle method shorthand
  const methodMatch = str.match(/^(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/);
  if (methodMatch) {
    return `${methodMatch[1]}(${methodMatch[2]})`;
  }

  // Handle class
  if (str.startsWith('class')) {
    return `class ${fn.name || 'anonymous'}`;
  }

  // Fallback
  const name = fn.name || 'anonymous';
  const length = fn.length;
  const params = Array(length).fill('arg').map((a, i) => `${a}${i}`).join(', ');
  return `${name}(${params})`;
}

/**
 * Get source code for a function (if available)
 * @param {Function} fn
 * @returns {string | undefined}
 */
export function getFunctionSource(fn) {
  if (typeof fn !== 'function') return undefined;

  try {
    const source = fn.toString();
    // Check if it's native code
    if (source.includes('[native code]')) {
      return undefined;
    }
    return source;
  } catch {
    return undefined;
  }
}

/**
 * Get size description for a value
 * @param {*} value
 * @returns {string | undefined}
 */
export function getSizeDescription(value) {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (value instanceof Map || value instanceof Set) {
    return `${value.size} items`;
  }
  if (typeof value === 'string') {
    return `${value.length} chars`;
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return `${keys.length} keys`;
  }
  return undefined;
}
