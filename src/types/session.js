/**
 * Session Types
 *
 * Types for session management (MRP /sessions endpoints).
 * @module types/session
 */

/**
 * @typedef {'iframe' | 'worker' | 'none'} IsolationMode
 */

/**
 * @typedef {Object} SessionInfo
 * @property {string} id - Unique session identifier
 * @property {string} language - Primary language for this session
 * @property {string} created - ISO timestamp of creation
 * @property {string} lastActivity - ISO timestamp of last activity
 * @property {number} executionCount - Number of executions
 * @property {number} variableCount - Number of variables in namespace
 * @property {IsolationMode} isolation - Session isolation mode
 */

/**
 * @typedef {Object} CreateSessionOptions
 * @property {string} [id] - Session ID (generated if not provided)
 * @property {string} [language='javascript'] - Primary language
 * @property {IsolationMode} [isolation='iframe'] - Isolation mode
 * @property {boolean} [allowMainAccess=false] - Allow access to main document
 * @property {Record<string, *>} [utilities] - Custom utilities to inject
 */

export {};
