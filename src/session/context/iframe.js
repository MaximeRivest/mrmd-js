/**
 * Iframe Execution Context
 *
 * Executes JavaScript in an isolated iframe environment.
 * Variables persist in the iframe's global scope between executions.
 *
 * @module session/context/iframe
 */

import { ConsoleCapture } from '../console-capture.js';
import { transformForPersistence } from '../../transform/persistence.js';
import { wrapForAsync } from '../../transform/async.js';

/**
 * @typedef {import('./interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('./interface.js').RawExecutionResult} RawExecutionResult
 * @typedef {import('./interface.js').LogEntry} LogEntry
 */

/**
 * @typedef {Object} IframeContextOptions
 * @property {boolean} [visible=false] - Whether iframe is visible
 * @property {HTMLElement} [target] - Target element for visible iframe
 * @property {boolean} [allowMainAccess=true] - Allow access to main document
 * @property {Record<string, *>} [utilities] - Custom utilities to inject
 * @property {Partial<CSSStyleDeclaration>} [styles] - Styles for visible iframe
 */

/**
 * Iframe-based execution context
 * @implements {ExecutionContext}
 */
export class IframeContext {
  /** @type {HTMLIFrameElement | null} */
  #iframe = null;

  /** @type {Window | null} */
  #ctx = null;

  /** @type {Set<string>} */
  #trackedVars = new Set();

  /** @type {ConsoleCapture | null} */
  #consoleCapture = null;

  /** @type {IframeContextOptions} */
  #options;

  /** @type {boolean} */
  #initialized = false;

  /**
   * @param {IframeContextOptions} [options]
   */
  constructor(options = {}) {
    this.#options = {
      visible: false,
      allowMainAccess: true,
      ...options,
    };
  }

  /**
   * Initialize the iframe
   */
  #initialize() {
    if (this.#initialized) return;

    // Create iframe
    this.#iframe = document.createElement('iframe');
    this.#iframe.sandbox.add('allow-scripts');
    this.#iframe.sandbox.add('allow-same-origin');

    if (this.#options.visible && this.#options.target) {
      // Visible mode
      const styles = this.#options.styles || {};
      this.#iframe.style.width = styles.width || '100%';
      this.#iframe.style.height = styles.height || '100%';
      this.#iframe.style.border = styles.border || 'none';
      this.#iframe.style.display = 'block';

      // Apply additional styles
      for (const [key, value] of Object.entries(styles)) {
        if (value && typeof value === 'string') {
          this.#iframe.style.setProperty(key, value);
        }
      }

      this.#options.target.appendChild(this.#iframe);
    } else {
      // Hidden mode
      this.#iframe.style.display = 'none';
      document.body.appendChild(this.#iframe);
    }

    // Get context
    this.#ctx = /** @type {Window} */ (this.#iframe.contentWindow);

    // Set up utilities
    this.#setupUtilities();

    // Set up console capture
    this.#consoleCapture = new ConsoleCapture(this.#ctx);
    this.#consoleCapture.start();

    // Initialize tracking set in iframe
    this.#ctx.__userVars__ = this.#trackedVars;

    this.#initialized = true;
  }

  /**
   * Set up utility functions in the context
   */
  #setupUtilities() {
    if (!this.#ctx) return;

    // Access to main document
    if (this.#options.allowMainAccess) {
      this.#ctx.mainDocument = document;
      this.#ctx.mainWindow = window;
    }

    // Sleep helper
    this.#ctx.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Print helper
    this.#ctx.print = (...args) => {
      this.#ctx?.console.log(...args);
    };

    // Display helper for rich output
    this.#ctx.display = (data, mimeType = 'text/plain') => {
      // Store for retrieval
      if (!this.#ctx.__displayQueue__) {
        this.#ctx.__displayQueue__ = [];
      }

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

      this.#ctx.__displayQueue__.push({ data: { [mimeType]: content }, metadata: {} });
    };

    // Inject custom utilities
    if (this.#options.utilities) {
      for (const [key, value] of Object.entries(this.#options.utilities)) {
        this.#ctx[key] = value;
      }
    }
  }

  /**
   * Execute code in the iframe
   * @param {string} code
   * @returns {Promise<RawExecutionResult>}
   */
  async execute(code) {
    this.#initialize();

    if (!this.#ctx) {
      throw new Error('Context not initialized');
    }

    // Clear display queue
    this.#ctx.__displayQueue__ = [];

    // Clear console capture
    this.#consoleCapture?.clear();

    // Transform code for persistence
    const transformed = transformForPersistence(code);

    // Wrap for async support
    const wrapped = wrapForAsync(transformed);

    const startTime = performance.now();

    try {
      // Execute
      const result = await this.#ctx.eval(wrapped);
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
    if (!this.#ctx) return {};

    const vars = {};
    for (const name of this.#trackedVars) {
      try {
        vars[name] = this.#ctx[name];
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
    if (!this.#ctx) return undefined;
    return this.#ctx[name];
  }

  /**
   * Check if variable exists
   * @param {string} name
   * @returns {boolean}
   */
  hasVariable(name) {
    if (!this.#ctx) return false;
    return name in this.#ctx;
  }

  /**
   * Get the global object
   * @returns {Window}
   */
  getGlobal() {
    this.#initialize();
    return /** @type {Window} */ (this.#ctx);
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
    if (!this.#initialized) return;

    // Destroy and reinitialize
    this.destroy();
    this.#initialized = false;
    this.#trackedVars = new Set();
    this.#initialize();
  }

  /**
   * Destroy the context
   */
  destroy() {
    this.#consoleCapture?.stop();
    this.#consoleCapture = null;

    if (this.#iframe) {
      this.#iframe.parentElement?.removeChild(this.#iframe);
      this.#iframe = null;
    }

    this.#ctx = null;
    this.#initialized = false;
  }

  /**
   * Check if this is main context
   * @returns {boolean}
   */
  isMainContext() {
    return false;
  }

  /**
   * Get the iframe element
   * @returns {HTMLIFrameElement | null}
   */
  getIframe() {
    return this.#iframe;
  }

  /**
   * Get display data queue
   * @returns {Array<{data: Record<string, string>, metadata: Record<string, *>}>}
   */
  getDisplayQueue() {
    return this.#ctx?.__displayQueue__ || [];
  }
}

/**
 * Create an iframe context
 * @param {IframeContextOptions} [options]
 * @returns {IframeContext}
 */
export function createIframeContext(options) {
  return new IframeContext(options);
}
