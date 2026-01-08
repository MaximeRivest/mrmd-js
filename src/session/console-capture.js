/**
 * Console Capture
 *
 * Intercepts console methods to capture output during execution.
 * @module session/console-capture
 */

/**
 * @typedef {import('./context/interface.js').LogEntry} LogEntry
 */

/**
 * Format arguments for logging
 * @param {Array<*>} args
 * @returns {string}
 */
function formatArgs(args) {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * Create a console capture for a window context
 */
export class ConsoleCapture {
  /** @type {Window} */
  #context;

  /** @type {LogEntry[]} */
  #queue = [];

  /** @type {Partial<Console> | null} */
  #originalConsole = null;

  /** @type {boolean} */
  #active = false;

  /**
   * @param {Window} context - The window context to capture console from
   */
  constructor(context) {
    this.#context = context;
  }

  /**
   * Start capturing console output
   */
  start() {
    if (this.#active) return;

    const console = this.#context.console;

    // Save originals
    this.#originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // Intercept methods
    console.log = (...args) => {
      this.#queue.push({ type: 'log', args, timestamp: Date.now() });
      this.#originalConsole?.log?.(...args);
    };

    console.info = (...args) => {
      this.#queue.push({ type: 'info', args, timestamp: Date.now() });
      this.#originalConsole?.info?.(...args);
    };

    console.warn = (...args) => {
      this.#queue.push({ type: 'warn', args, timestamp: Date.now() });
      this.#originalConsole?.warn?.(...args);
    };

    console.error = (...args) => {
      this.#queue.push({ type: 'error', args, timestamp: Date.now() });
      this.#originalConsole?.error?.(...args);
    };

    this.#active = true;
  }

  /**
   * Stop capturing and restore original console
   */
  stop() {
    if (!this.#active || !this.#originalConsole) return;

    const console = this.#context.console;

    if (this.#originalConsole.log) {
      console.log = this.#originalConsole.log;
    }
    if (this.#originalConsole.info) {
      console.info = this.#originalConsole.info;
    }
    if (this.#originalConsole.warn) {
      console.warn = this.#originalConsole.warn;
    }
    if (this.#originalConsole.error) {
      console.error = this.#originalConsole.error;
    }

    this.#originalConsole = null;
    this.#active = false;
  }

  /**
   * Clear the log queue
   */
  clear() {
    this.#queue = [];
  }

  /**
   * Get captured logs and clear queue
   * @returns {LogEntry[]}
   */
  flush() {
    const logs = this.#queue;
    this.#queue = [];
    return logs;
  }

  /**
   * Get captured logs without clearing
   * @returns {LogEntry[]}
   */
  peek() {
    return [...this.#queue];
  }

  /**
   * Convert logs to stdout/stderr strings
   * @param {LogEntry[]} logs
   * @returns {{ stdout: string, stderr: string }}
   */
  static toOutput(logs) {
    const stdout = [];
    const stderr = [];

    for (const log of logs) {
      const formatted = formatArgs(log.args);
      if (log.type === 'error') {
        stderr.push(`Error: ${formatted}`);
      } else if (log.type === 'warn') {
        stderr.push(`Warning: ${formatted}`);
      } else {
        stdout.push(formatted);
      }
    }

    return {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
    };
  }
}

/**
 * Create a console capture for a context
 * @param {Window} context
 * @returns {ConsoleCapture}
 */
export function createConsoleCapture(context) {
  return new ConsoleCapture(context);
}
