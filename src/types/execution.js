/**
 * Execution Types
 *
 * Types for code execution (MRP /execute endpoints).
 * @module types/execution
 */

/**
 * @typedef {Object} ExecuteOptions
 * @property {string} [session='default'] - Session ID
 * @property {string} [language] - Language override
 * @property {boolean} [storeHistory=true] - Add to execution history
 * @property {boolean} [silent=false] - Suppress output
 * @property {string} [execId] - Unique execution identifier
 * @property {string} [cellId] - Cell identifier (for linking)
 * @property {Record<string, *>} [cellMeta] - Metadata from code fence
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - Whether execution succeeded
 * @property {string} stdout - Standard output (console.log, etc.)
 * @property {string} stderr - Standard error (console.error, etc.)
 * @property {*} [result] - Return value (raw)
 * @property {string} [resultString] - Return value (formatted string)
 * @property {ExecutionError} [error] - Error information if failed
 * @property {DisplayData[]} displayData - Rich display outputs
 * @property {Asset[]} assets - Generated assets
 * @property {number} executionCount - Execution count in session
 * @property {number} duration - Execution duration in milliseconds
 * @property {string[]} [imports] - Detected imports
 */

/**
 * @typedef {Object} ExecutionError
 * @property {string} type - Error type/class name
 * @property {string} message - Error message
 * @property {string[]} [traceback] - Stack trace lines
 * @property {number} [line] - Line number where error occurred
 * @property {number} [column] - Column number where error occurred
 */

/**
 * @typedef {Object} DisplayData
 * @property {Record<string, string>} data - MIME type → content mapping
 * @property {Record<string, *>} metadata - Additional metadata
 */

/**
 * @typedef {'image' | 'html' | 'json' | 'other'} AssetType
 */

/**
 * @typedef {Object} Asset
 * @property {string} path - Asset path/identifier
 * @property {string} url - URL to access asset (blob URL in browser)
 * @property {string} mimeType - MIME type
 * @property {AssetType} assetType - Asset type category
 * @property {number} [size] - Size in bytes
 */

export {};
