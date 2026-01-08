/**
 * Symbol Inspection
 *
 * Provides detailed inspection information for symbols including
 * signature, documentation, source code, and children.
 *
 * @module lsp/inspect
 */

import { parseIdentifierAtPosition, splitObjectPath } from './parse.js';
import {
  formatValue,
  formatValueShort,
  getTypeName,
  getCompletionKind,
  getFunctionSignature,
  getFunctionSource,
  isExpandable,
  getSizeDescription,
} from './format.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/inspection.js').InspectOptions} InspectOptions
 * @typedef {import('../types/inspection.js').InspectResult} InspectResult
 * @typedef {import('../types/variables.js').VariableInfo} VariableInfo
 */

/**
 * Get detailed inspection information at cursor position
 *
 * @param {string} code - The code being edited
 * @param {number} cursor - Cursor position (0-indexed)
 * @param {ExecutionContext} context - Execution context for live values
 * @param {InspectOptions} [options]
 * @returns {InspectResult}
 */
export function getInspectInfo(code, cursor, context, options = {}) {
  const detail = options.detail ?? 0;

  // Find identifier at cursor
  const identifier = parseIdentifierAtPosition(code, cursor);

  if (!identifier) {
    return { found: false, source: 'runtime' };
  }

  // Resolve the value
  const value = resolveValue(identifier.full, context);

  // Check if it exists
  const exists = value !== undefined || hasVariable(identifier.full, context);

  if (!exists) {
    return { found: false, source: 'runtime' };
  }

  /** @type {InspectResult} */
  const result = {
    found: true,
    source: 'runtime',
    name: identifier.name,
    kind: getInspectKind(value),
    type: getTypeName(value),
    value: formatValueShort(value, 200),
  };

  // Add function-specific info
  if (typeof value === 'function') {
    result.signature = getFunctionSignature(value);

    // Detail level 1: add docstring
    if (detail >= 1) {
      result.docstring = getDocstring(value);
    }

    // Detail level 2: add source code
    if (detail >= 2) {
      result.sourceCode = getFunctionSource(value);
    }
  }

  // Add children for expandable values
  if (detail >= 1 && isExpandable(value)) {
    result.children = getChildren(value);
  }

  return result;
}

/**
 * Inspect a specific object path
 *
 * @param {string} path - Object path to inspect (e.g., "obj.prop")
 * @param {ExecutionContext} context
 * @param {InspectOptions} [options]
 * @returns {InspectResult}
 */
export function inspectPath(path, context, options = {}) {
  const detail = options.detail ?? 0;

  const value = resolveValue(path, context);
  const exists = value !== undefined || hasVariable(path, context);

  if (!exists) {
    return { found: false, source: 'runtime' };
  }

  const parts = splitObjectPath(path);
  const name = parts[parts.length - 1] || path;

  /** @type {InspectResult} */
  const result = {
    found: true,
    source: 'runtime',
    name,
    kind: getInspectKind(value),
    type: getTypeName(value),
    value: formatValueShort(value, 200),
  };

  if (typeof value === 'function') {
    result.signature = getFunctionSignature(value);

    if (detail >= 1) {
      result.docstring = getDocstring(value);
    }

    if (detail >= 2) {
      result.sourceCode = getFunctionSource(value);
    }
  }

  if (detail >= 1 && isExpandable(value)) {
    result.children = getChildren(value);
  }

  return result;
}

/**
 * Get kind string for inspection
 * @param {*} value
 * @returns {string}
 */
function getInspectKind(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'function') {
    const str = value.toString();
    if (str.startsWith('class ')) return 'class';
    if (/^(async\s+)?function\s*\*/.test(str)) return 'generator';
    if (str.includes('=>')) return 'arrow-function';
    return 'function';
  }

  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Error) return 'error';
  if (value instanceof Promise) return 'promise';

  const type = typeof value;
  if (type === 'object') return 'object';

  return type;
}

/**
 * Get docstring for a function (if available)
 * @param {Function} fn
 * @returns {string | undefined}
 */
function getDocstring(fn) {
  if (typeof fn !== 'function') return undefined;

  try {
    const source = fn.toString();

    // Try to find JSDoc-style comments
    // Look for /** ... */ before function declaration
    // This won't work for most runtime functions, but worth trying
    const jsdocMatch = source.match(/\/\*\*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      return jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line && !line.startsWith('@'))
        .join('\n')
        .trim();
    }

    // Check for built-in documentation (MDN-style)
    const builtinDocs = getBuiltinDocumentation(fn);
    if (builtinDocs) {
      return builtinDocs;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get documentation for built-in functions
 * @param {Function} fn
 * @returns {string | undefined}
 */
function getBuiltinDocumentation(fn) {
  // Map of common built-in functions to their descriptions
  const docs = {
    // Array methods
    'push': 'Adds elements to the end of an array and returns the new length.',
    'pop': 'Removes the last element from an array and returns it.',
    'shift': 'Removes the first element from an array and returns it.',
    'unshift': 'Adds elements to the beginning of an array and returns the new length.',
    'slice': 'Returns a shallow copy of a portion of an array.',
    'splice': 'Changes the contents of an array by removing or replacing elements.',
    'map': 'Creates a new array with the results of calling a function on every element.',
    'filter': 'Creates a new array with all elements that pass a test.',
    'reduce': 'Executes a reducer function on each element, resulting in a single value.',
    'forEach': 'Executes a function once for each array element.',
    'find': 'Returns the first element that satisfies a testing function.',
    'findIndex': 'Returns the index of the first element that satisfies a testing function.',
    'includes': 'Determines whether an array includes a certain value.',
    'indexOf': 'Returns the first index at which a given element can be found.',
    'join': 'Joins all elements of an array into a string.',
    'sort': 'Sorts the elements of an array in place and returns the array.',
    'reverse': 'Reverses the elements of an array in place.',
    'concat': 'Merges two or more arrays into a new array.',
    'flat': 'Creates a new array with all sub-array elements concatenated.',
    'flatMap': 'Maps each element then flattens the result into a new array.',

    // String methods
    'charAt': 'Returns the character at a specified index.',
    'charCodeAt': 'Returns the Unicode value of the character at an index.',
    'split': 'Splits a string into an array of substrings.',
    'substring': 'Returns a portion of the string between two indices.',
    'substr': 'Returns a portion of the string starting from an index.',
    'toLowerCase': 'Returns the string converted to lowercase.',
    'toUpperCase': 'Returns the string converted to uppercase.',
    'trim': 'Removes whitespace from both ends of a string.',
    'trimStart': 'Removes whitespace from the beginning of a string.',
    'trimEnd': 'Removes whitespace from the end of a string.',
    'replace': 'Returns a new string with some or all matches replaced.',
    'replaceAll': 'Returns a new string with all matches replaced.',
    'match': 'Retrieves the result of matching a string against a regex.',
    'search': 'Searches for a match between a regex and the string.',
    'startsWith': 'Determines whether a string begins with specified characters.',
    'endsWith': 'Determines whether a string ends with specified characters.',
    'padStart': 'Pads the string with another string until it reaches the given length.',
    'padEnd': 'Pads the string with another string at the end.',
    'repeat': 'Returns a new string with copies of the original string.',

    // Object methods
    'hasOwnProperty': 'Returns a boolean indicating whether the object has the property.',
    'toString': 'Returns a string representation of the object.',
    'valueOf': 'Returns the primitive value of the object.',

    // Global functions
    'parseInt': 'Parses a string argument and returns an integer.',
    'parseFloat': 'Parses a string argument and returns a floating point number.',
    'isNaN': 'Determines whether a value is NaN.',
    'isFinite': 'Determines whether a value is a finite number.',
    'encodeURI': 'Encodes a URI by replacing certain characters.',
    'decodeURI': 'Decodes a URI previously created by encodeURI.',
    'encodeURIComponent': 'Encodes a URI component by replacing certain characters.',
    'decodeURIComponent': 'Decodes a URI component.',

    // JSON
    'parse': 'Parses a JSON string and returns the JavaScript value.',
    'stringify': 'Converts a JavaScript value to a JSON string.',

    // Math
    'abs': 'Returns the absolute value of a number.',
    'ceil': 'Rounds a number up to the next largest integer.',
    'floor': 'Rounds a number down to the largest integer.',
    'round': 'Rounds a number to the nearest integer.',
    'max': 'Returns the largest of zero or more numbers.',
    'min': 'Returns the smallest of zero or more numbers.',
    'pow': 'Returns the base raised to the exponent power.',
    'sqrt': 'Returns the square root of a number.',
    'random': 'Returns a random number between 0 and 1.',
    'sin': 'Returns the sine of a number.',
    'cos': 'Returns the cosine of a number.',
    'tan': 'Returns the tangent of a number.',
    'log': 'Returns the natural logarithm of a number.',
    'exp': 'Returns e raised to the power of a number.',

    // Console
    'log': 'Outputs a message to the console.',
    'error': 'Outputs an error message to the console.',
    'warn': 'Outputs a warning message to the console.',
    'info': 'Outputs an informational message to the console.',
    'debug': 'Outputs a debug message to the console.',
    'table': 'Displays tabular data as a table.',
    'clear': 'Clears the console.',
    'group': 'Creates a new inline group in the console.',
    'groupEnd': 'Exits the current inline group in the console.',
    'time': 'Starts a timer with a specified label.',
    'timeEnd': 'Stops a timer and logs the elapsed time.',
  };

  const name = fn.name;
  return docs[name];
}

/**
 * Get children of an expandable value as VariableInfo[]
 * @param {*} value
 * @param {number} [maxChildren=100]
 * @returns {VariableInfo[]}
 */
function getChildren(value, maxChildren = 100) {
  if (value === null || value === undefined) return [];

  /** @type {VariableInfo[]} */
  const children = [];

  if (Array.isArray(value)) {
    const items = value.slice(0, maxChildren);
    for (let i = 0; i < items.length; i++) {
      children.push(formatVariableInfo(String(i), items[i]));
    }
  } else if (value instanceof Map) {
    let count = 0;
    for (const [k, v] of value) {
      if (count >= maxChildren) break;
      children.push(formatVariableInfo(String(k), v));
      count++;
    }
  } else if (value instanceof Set) {
    let count = 0;
    for (const v of value) {
      if (count >= maxChildren) break;
      children.push(formatVariableInfo(String(count), v));
      count++;
    }
  } else if (typeof value === 'object') {
    const keys = Object.keys(value).slice(0, maxChildren);
    for (const key of keys) {
      try {
        children.push(formatVariableInfo(key, value[key]));
      } catch {
        children.push({
          name: key,
          type: 'unknown',
          value: '(inaccessible)',
          expandable: false,
        });
      }
    }
  }

  return children;
}

/**
 * Format a variable for display
 * @param {string} name
 * @param {*} value
 * @returns {VariableInfo}
 */
function formatVariableInfo(name, value) {
  /** @type {VariableInfo} */
  const info = {
    name,
    type: getTypeName(value),
    value: formatValueShort(value, 100),
    expandable: isExpandable(value),
  };

  // Add size info
  const size = getSizeDescription(value);
  if (size) {
    info.size = size;
  }

  // Add length for arrays/strings
  if (Array.isArray(value)) {
    info.length = value.length;
  } else if (typeof value === 'string') {
    info.length = value.length;
  } else if (value instanceof Map || value instanceof Set) {
    info.length = value.size;
  }

  // Add keys preview for objects
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (!(value instanceof Map) && !(value instanceof Set)) {
      info.keys = Object.keys(value).slice(0, 10);
    }
  }

  return info;
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

/**
 * Check if a variable exists in context
 * @param {string} path
 * @param {ExecutionContext} context
 * @returns {boolean}
 */
function hasVariable(path, context) {
  const parts = splitObjectPath(path);
  if (parts.length === 0) return false;

  if (context.hasVariable(parts[0])) {
    return true;
  }

  // Check global
  const global = context.getGlobal();
  if (global && parts[0] in global) {
    return true;
  }

  return false;
}
