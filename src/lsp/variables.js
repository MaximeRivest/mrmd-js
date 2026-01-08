/**
 * Variable Inspection
 *
 * Provides variable listing and detailed inspection for the
 * variables panel in notebook UIs.
 *
 * @module lsp/variables
 */

import { splitObjectPath } from './parse.js';
import {
  formatValue,
  formatValueShort,
  getTypeName,
  isExpandable,
  getSizeDescription,
} from './format.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/variables.js').VariableFilter} VariableFilter
 * @typedef {import('../types/variables.js').VariableInfo} VariableInfo
 * @typedef {import('../types/variables.js').VariableDetailOptions} VariableDetailOptions
 * @typedef {import('../types/variables.js').VariableDetail} VariableDetail
 */

/**
 * List all variables in the session namespace
 *
 * @param {ExecutionContext} context - Execution context
 * @param {VariableFilter} [filter] - Optional filter
 * @returns {VariableInfo[]}
 */
export function listVariables(context, filter = {}) {
  const vars = context.getVariables();
  const tracked = context.getTrackedVariables();

  /** @type {VariableInfo[]} */
  const result = [];

  for (const name of tracked) {
    if (!(name in vars)) continue;

    const value = vars[name];

    // Apply filters
    if (filter.excludePrivate && name.startsWith('_')) continue;
    if (filter.namePattern && !new RegExp(filter.namePattern).test(name)) continue;
    if (filter.types && !filter.types.includes(getTypeName(value))) continue;

    result.push(formatVariableInfo(name, value));
  }

  // Sort by name
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

/**
 * Get detailed information about a variable
 *
 * @param {string} name - Variable name
 * @param {ExecutionContext} context - Execution context
 * @param {VariableDetailOptions} [options]
 * @returns {VariableDetail | null}
 */
export function getVariableDetail(name, context, options = {}) {
  let value = context.getVariable(name);

  // Navigate path
  if (options.path && options.path.length > 0) {
    for (const key of options.path) {
      if (value == null) return null;

      try {
        if (value instanceof Map) {
          value = value.get(key);
        } else {
          value = /** @type {*} */ (value)[key];
        }
      } catch {
        return null;
      }
    }
  }

  // Check if exists
  if (value === undefined && !context.hasVariable(name)) {
    return null;
  }

  const maxChildren = options.maxChildren ?? 100;
  const maxValueLength = options.maxValueLength ?? 1000;

  const info = formatVariableInfo(name, value);

  /** @type {VariableDetail} */
  const detail = {
    ...info,
    fullValue: formatValue(value, maxValueLength),
    truncated: false,
  };

  // Add children for expandable values
  if (isExpandable(value)) {
    const children = getChildren(value);
    detail.children = children.slice(0, maxChildren).map(
      ([k, v]) => formatVariableInfo(k, v)
    );
    detail.truncated = children.length > maxChildren;

    // Get methods and attributes for objects
    if (typeof value === 'object' && value !== null) {
      detail.methods = getMethods(value);
      detail.attributes = getAttributes(value);
    }
  }

  return detail;
}

/**
 * Expand a variable by path
 *
 * @param {string} baseName - Base variable name
 * @param {string[]} path - Path to expand
 * @param {ExecutionContext} context
 * @param {number} [maxChildren=100]
 * @returns {VariableInfo[] | null}
 */
export function expandVariable(baseName, path, context, maxChildren = 100) {
  let value = context.getVariable(baseName);

  if (value === undefined) return null;

  // Navigate path
  for (const key of path) {
    if (value == null) return null;

    try {
      if (value instanceof Map) {
        value = value.get(key);
      } else {
        value = /** @type {*} */ (value)[key];
      }
    } catch {
      return null;
    }
  }

  if (!isExpandable(value)) {
    return null;
  }

  const children = getChildren(value);
  return children.slice(0, maxChildren).map(([k, v]) => formatVariableInfo(k, v));
}

/**
 * Format a variable for display
 * @param {string} name
 * @param {*} value
 * @returns {VariableInfo}
 */
export function formatVariableInfo(name, value) {
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

  // Add shape for typed arrays
  if (ArrayBuffer.isView(value) && 'length' in value) {
    // @ts-ignore
    info.length = value.length;
    info.dtype = value.constructor.name.replace('Array', '').toLowerCase();
  }

  // Add keys preview for objects
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (!(value instanceof Map) && !(value instanceof Set) && !ArrayBuffer.isView(value)) {
      info.keys = Object.keys(value).slice(0, 10);
    }
  }

  return info;
}

/**
 * Get children of an expandable value
 * @param {*} value
 * @returns {Array<[string, *]>}
 */
export function getChildren(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.map((v, i) => [String(i), v]);
  }

  if (value instanceof Map) {
    return Array.from(value.entries()).map(([k, v]) => [String(k), v]);
  }

  if (value instanceof Set) {
    return Array.from(value).map((v, i) => [String(i), v]);
  }

  if (typeof value === 'object') {
    return Object.entries(value);
  }

  return [];
}

/**
 * Get method names of an object
 * @param {*} value
 * @returns {string[]}
 */
export function getMethods(value) {
  const methods = new Set();
  let obj = value;
  let depth = 0;

  while (obj != null && obj !== Object.prototype && depth < 3) {
    for (const name of Object.getOwnPropertyNames(obj)) {
      if (name === 'constructor') continue;

      try {
        if (typeof obj[name] === 'function') {
          methods.add(name);
        }
      } catch {
        // Skip inaccessible
      }
    }

    obj = Object.getPrototypeOf(obj);
    depth++;
  }

  return Array.from(methods).sort();
}

/**
 * Get attribute (non-method) names of an object
 * @param {*} value
 * @returns {string[]}
 */
export function getAttributes(value) {
  const attrs = [];

  for (const name of Object.getOwnPropertyNames(value)) {
    try {
      if (typeof value[name] !== 'function') {
        attrs.push(name);
      }
    } catch {
      // Skip inaccessible
    }
  }

  return attrs.sort();
}
