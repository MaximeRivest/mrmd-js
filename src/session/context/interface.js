/**
 * Execution Context Interface
 *
 * Defines the interface for execution contexts (iframe, worker, main).
 * @module session/context/interface
 */

/**
 * @typedef {Object} LogEntry
 * @property {'log' | 'info' | 'warn' | 'error'} type
 * @property {Array<*>} args
 * @property {number} timestamp
 */

/**
 * @typedef {Object} RawExecutionResult
 * @property {*} result - Return value
 * @property {LogEntry[]} logs - Captured log entries
 * @property {Error} [error] - Error if execution failed
 * @property {number} duration - Duration in milliseconds
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {(code: string) => Promise<RawExecutionResult>} execute - Execute code
 * @property {() => Record<string, *>} getVariables - Get all user-defined variables
 * @property {(name: string) => *} getVariable - Get a specific variable
 * @property {(name: string) => boolean} hasVariable - Check if variable exists
 * @property {() => Window} getGlobal - Get the global object
 * @property {(name: string) => void} trackVariable - Track a declared variable
 * @property {() => Set<string>} getTrackedVariables - Get tracked variable names
 * @property {() => void} reset - Clear all variables and state
 * @property {() => void} destroy - Cleanup and release resources
 * @property {() => boolean} isMainContext - Whether this is main window
 * @property {() => HTMLIFrameElement | null} getIframe - Get iframe if applicable
 */

export {};
