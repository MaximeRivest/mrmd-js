/**
 * Analysis Types
 *
 * Types for code analysis (MRP /is_complete and /format endpoints).
 * @module types/analysis
 */

/**
 * @typedef {'complete' | 'incomplete' | 'invalid' | 'unknown'} CompletenessStatus
 */

/**
 * @typedef {Object} IsCompleteResult
 * @property {CompletenessStatus} status - Completeness status
 * @property {string} [indent] - Suggested indent for continuation
 */

/**
 * @typedef {Object} FormatResult
 * @property {string} formatted - Formatted code
 * @property {boolean} changed - Whether code was changed
 */

export {};
