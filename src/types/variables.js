/**
 * Variables Types
 *
 * Types for variable inspection (MRP /variables endpoints).
 * @module types/variables
 */

/**
 * @typedef {Object} VariableFilter
 * @property {string[]} [types] - Only include these types
 * @property {string} [namePattern] - Name must match this regex
 * @property {boolean} [excludePrivate] - Exclude names starting with _
 */

/**
 * @typedef {Object} VariableInfo
 * @property {string} name - Variable name
 * @property {string} type - Type string
 * @property {string} value - Value preview (truncated)
 * @property {string} [size] - Size description (e.g., "1.2 KB")
 * @property {boolean} expandable - Whether this can be expanded
 * @property {number[]} [shape] - Shape for arrays/matrices
 * @property {string} [dtype] - Data type for typed arrays
 * @property {number} [length] - Length for arrays/strings
 * @property {string[]} [keys] - Keys for objects/maps
 */

/**
 * @typedef {Object} VariableDetailOptions
 * @property {string} [session] - Session ID
 * @property {string[]} [path] - Path to drill into
 * @property {number} [maxChildren=100] - Max children to return
 * @property {number} [maxValueLength=1000] - Max chars for value strings
 */

/**
 * @typedef {Object} VariableDetail
 * @property {string} name - Variable name
 * @property {string} type - Type string
 * @property {string} value - Value preview
 * @property {string} [size] - Size description
 * @property {boolean} expandable - Whether expandable
 * @property {number[]} [shape] - Shape for arrays
 * @property {string} [dtype] - Data type
 * @property {number} [length] - Length
 * @property {string[]} [keys] - Keys
 * @property {string} [fullValue] - Full value (up to maxValueLength)
 * @property {VariableInfo[]} [children] - Child items
 * @property {string[]} [methods] - Available methods
 * @property {string[]} [attributes] - Available attributes
 * @property {boolean} truncated - Whether results were truncated
 */

export {};
