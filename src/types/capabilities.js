/**
 * Capabilities Types
 *
 * Types for runtime capability discovery (MRP /capabilities endpoint).
 * @module types/capabilities
 */

/**
 * @typedef {Object} Capabilities
 * @property {string} runtime - Runtime identifier
 * @property {string} version - Runtime version
 * @property {string[]} languages - Supported language identifiers
 * @property {Features} features - Feature support flags
 * @property {string} [lspFallback] - LSP fallback WebSocket URL
 * @property {string} defaultSession - Default session ID
 * @property {number} maxSessions - Maximum concurrent sessions
 * @property {BrowserEnvironment} environment - Environment information
 */

/**
 * @typedef {Object} Features
 * @property {boolean} execute - Execute code and return result
 * @property {boolean} executeStream - Stream execution output
 * @property {boolean} interrupt - Interrupt running execution
 * @property {boolean} complete - Tab completion from live session
 * @property {boolean} inspect - Get symbol info (signature, docs, source)
 * @property {boolean} hover - Quick value/type preview
 * @property {boolean} variables - List variables in namespace
 * @property {boolean} variableExpand - Drill into objects
 * @property {boolean} reset - Clear namespace without destroying session
 * @property {boolean} isComplete - Check if code is complete statement
 * @property {boolean} format - Format/prettify code
 * @property {boolean} assets - Asset support (blob URLs)
 */

/**
 * @typedef {Object} BrowserEnvironment
 * @property {string} userAgent - User agent string
 * @property {string} language - Browser language
 * @property {string} platform - Platform
 * @property {boolean} isSecureContext - Is secure context (HTTPS)
 */

export {};
