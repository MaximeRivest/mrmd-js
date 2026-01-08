/**
 * Main Execution Context
 *
 * Executes JavaScript in the main window context (no isolation).
 * Provides full access to the page's DOM and state.
 *
 * @module session/context/main
 */

import { ConsoleCapture } from '../console-capture.js';
import { transformForPersistence } from '../../transform/persistence.js';
import { wrapForAsync } from '../../transform/async.js';

/**
 * @typedef {import('./interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('./interface.js').RawExecutionResult} RawExecutionResult
 */

/**
 * @typedef {Object} MainContextOptions
 * @property {Record<string, *>} [utilities] - Custom utilities to inject
 */

/**
 * Main window execution context (no isolation)
 * @implements {ExecutionContext}
 */
export class MainContext {
  /** @type {Set<string>} */
  #trackedVars = new Set();

  /** @type {ConsoleCapture | null} */
  #consoleCapture = null;

  /** @type {MainContextOptions} */
  #options;

  /** @type {boolean} */
  #initialized = false;

  /** @type {Array<{data: Record<string, string>, metadata: Record<string, *>}>} */
  #displayQueue = [];

  /**
   * @param {MainContextOptions} [options]
   */
  constructor(options = {}) {
    this.#options = options;
  }

  /**
   * Initialize the context
   */
  #initialize() {
    if (this.#initialized) return;

    // Set up utilities on window
    this.#setupUtilities();

    // Set up console capture
    this.#consoleCapture = new ConsoleCapture(window);
    this.#consoleCapture.start();

    this.#initialized = true;
  }

  /**
   * Set up utility functions
   */
  #setupUtilities() {
    // Sleep helper (if not already defined)
    if (!('sleep' in window)) {
      /** @type {*} */ (window).sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Print helper
    if (!('print' in window) || typeof window.print !== 'function') {
      /** @type {*} */ (window).print = (...args) => {
        console.log(...args);
      };
    }

    // Display helper
    /** @type {*} */ (window).__mrmd_display__ = (data, mimeType = 'text/plain') => {
      let content;
      if (typeof data === 'string') {
        content = data;
      } else if (data instanceof HTMLElement) {
        content = data.outerHTML;
        mimeType = 'text/html';
      } else {
        try {
          content = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
        } catch {
          content = String(data);
        }
      }

      this.#displayQueue.push({ data: { [mimeType]: content }, metadata: {} });
    };

    // Inject custom utilities
    if (this.#options.utilities) {
      for (const [key, value] of Object.entries(this.#options.utilities)) {
        /** @type {*} */ (window)[key] = value;
      }
    }
  }

  /**
   * Execute code in main context
   * @param {string} code
   * @returns {Promise<RawExecutionResult>}
   */
  async execute(code) {
    this.#initialize();

    // Clear display queue
    this.#displayQueue = [];

    // Clear console capture
    this.#consoleCapture?.clear();

    // Transform code for persistence
    const transformed = transformForPersistence(code);

    // Wrap for async support
    const wrapped = wrapForAsync(transformed);

    const startTime = performance.now();

    try {
      // Execute using eval on window
      const result = await eval(wrapped);
      const duration = performance.now() - startTime;

      // Get logs
      const logs = this.#consoleCapture?.flush() || [];

      return {
        result,
        logs,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const logs = this.#consoleCapture?.flush() || [];

      return {
        result: undefined,
        logs,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };
    }
  }

  /**
   * Get all user-defined variables
   * @returns {Record<string, *>}
   */
  getVariables() {
    const vars = {};
    for (const name of this.#trackedVars) {
      try {
        vars[name] = /** @type {*} */ (window)[name];
      } catch {
        // Skip inaccessible
      }
    }
    return vars;
  }

  /**
   * Get a specific variable
   * @param {string} name
   * @returns {*}
   */
  getVariable(name) {
    return /** @type {*} */ (window)[name];
  }

  /**
   * Check if variable exists
   * @param {string} name
   * @returns {boolean}
   */
  hasVariable(name) {
    return name in window;
  }

  /**
   * Get the global object
   * @returns {Window}
   */
  getGlobal() {
    return window;
  }

  /**
   * Track a declared variable
   * @param {string} name
   */
  trackVariable(name) {
    this.#trackedVars.add(name);
  }

  /**
   * Get tracked variable names
   * @returns {Set<string>}
   */
  getTrackedVariables() {
    return this.#trackedVars;
  }

  /**
   * Reset the context
   */
  reset() {
    // Delete tracked variables from window
    for (const name of this.#trackedVars) {
      try {
        delete /** @type {*} */ (window)[name];
      } catch {
        // Some properties can't be deleted
      }
    }
    this.#trackedVars = new Set();
    this.#displayQueue = [];
  }

  /**
   * Destroy the context
   */
  destroy() {
    this.#consoleCapture?.stop();
    this.#consoleCapture = null;

    // Clean up tracked variables
    this.reset();

    // Clean up utilities we added
    try {
      delete /** @type {*} */ (window).__mrmd_display__;
    } catch {
      // Ignore
    }

    this.#initialized = false;
  }

  /**
   * Check if this is main context
   * @returns {boolean}
   */
  isMainContext() {
    return true;
  }

  /**
   * Get the iframe element
   * @returns {null}
   */
  getIframe() {
    return null;
  }

  /**
   * Get display data queue
   * @returns {Array<{data: Record<string, string>, metadata: Record<string, *>}>}
   */
  getDisplayQueue() {
    return this.#displayQueue;
  }
}

/**
 * Create a main context
 * @param {MainContextOptions} [options]
 * @returns {MainContext}
 */
export function createMainContext(options) {
  return new MainContext(options);
}
