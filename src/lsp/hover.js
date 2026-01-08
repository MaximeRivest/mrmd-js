/**
 * Hover Information
 *
 * Provides hover information (type and value preview) for symbols
 * by introspecting live values in the execution context.
 *
 * @module lsp/hover
 */

import { parseIdentifierAtPosition, splitObjectPath } from './parse.js';
import { formatValueShort, getTypeName, getFunctionSignature } from './format.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/inspection.js').HoverResult} HoverResult
 */

/**
 * Get hover information at cursor position
 *
 * @param {string} code - The code being edited
 * @param {number} cursor - Cursor position (0-indexed)
 * @param {ExecutionContext} context - Execution context for live values
 * @returns {HoverResult}
 */
export function getHoverInfo(code, cursor, context) {
  // Find identifier at cursor
  const identifier = parseIdentifierAtPosition(code, cursor);

  if (!identifier) {
    return { found: false };
  }

  // Resolve the value
  const value = resolveValue(identifier.full, context);

  // Check if it exists
  const exists = value !== undefined || hasVariable(identifier.full, context);

  if (!exists) {
    return { found: false };
  }

  /** @type {HoverResult} */
  const result = {
    found: true,
    name: identifier.full,
    type: getTypeName(value),
  };

  // Add signature for functions
  if (typeof value === 'function') {
    result.signature = getFunctionSignature(value);
  } else {
    // Add value preview for non-functions
    result.value = formatValueShort(value, 100);
  }

  return result;
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
