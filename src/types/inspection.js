/**
 * Inspection Types
 *
 * Types for symbol inspection (MRP /inspect and /hover endpoints).
 * @module types/inspection
 */

/**
 * @typedef {Object} InspectOptions
 * @property {string} [session] - Session ID
 * @property {0 | 1 | 2} [detail=0] - Detail level: 0=signature, 1=+docs, 2=+source
 */

/**
 * @typedef {Object} InspectResult
 * @property {boolean} found - Whether symbol was found
 * @property {'runtime' | 'lsp' | 'static'} source - Where info came from
 * @property {string} [name] - Symbol name
 * @property {string} [kind] - Symbol kind
 * @property {string} [type] - Type string
 * @property {string} [signature] - Function/method signature
 * @property {string} [docstring] - Documentation string
 * @property {string} [sourceCode] - Source code (if available)
 * @property {string} [file] - File where defined
 * @property {number} [line] - Line number
 * @property {string} [value] - Value preview
 * @property {import('./variables.js').VariableInfo[]} [children] - Children for expandable
 */

/**
 * @typedef {Object} HoverResult
 * @property {boolean} found - Whether info was found
 * @property {string} [name] - Symbol name
 * @property {string} [type] - Type string
 * @property {string} [value] - Value preview
 * @property {string} [signature] - Function signature
 */

export {};
