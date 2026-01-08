/**
 * Streaming Types
 *
 * Types for streaming execution (MRP /execute/stream endpoint).
 * @module types/streaming
 */

/**
 * @typedef {StartEvent | StdoutEvent | StderrEvent | StdinRequestEvent | DisplayEvent | AssetEvent | ResultEvent | ErrorEvent | DoneEvent} StreamEvent
 */

/**
 * @typedef {Object} StartEvent
 * @property {'start'} type
 * @property {string} execId
 * @property {string} timestamp
 */

/**
 * @typedef {Object} StdoutEvent
 * @property {'stdout'} type
 * @property {string} content
 * @property {string} accumulated
 */

/**
 * @typedef {Object} StderrEvent
 * @property {'stderr'} type
 * @property {string} content
 * @property {string} accumulated
 */

/**
 * @typedef {Object} StdinRequestEvent
 * @property {'stdin_request'} type
 * @property {string} prompt
 * @property {boolean} password
 * @property {string} execId
 */

/**
 * @typedef {Object} DisplayEvent
 * @property {'display'} type
 * @property {Record<string, string>} data
 * @property {Record<string, *>} metadata
 */

/**
 * @typedef {Object} AssetEvent
 * @property {'asset'} type
 * @property {string} path
 * @property {string} url
 * @property {string} mimeType
 * @property {string} assetType
 */

/**
 * @typedef {Object} ResultEvent
 * @property {'result'} type
 * @property {import('./execution.js').ExecutionResult} result
 */

/**
 * @typedef {Object} ErrorEvent
 * @property {'error'} type
 * @property {import('./execution.js').ExecutionError} error
 */

/**
 * @typedef {Object} DoneEvent
 * @property {'done'} type
 */

export {};
