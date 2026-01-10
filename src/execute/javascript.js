/**
 * JavaScript Executor
 *
 * Executes JavaScript code in an execution context.
 * Handles variable persistence, async/await, and console output.
 *
 * @module execute/javascript
 */

import { BaseExecutor } from './interface.js';
import { transformForPersistence } from '../transform/persistence.js';
import { wrapWithLastExpression } from '../transform/async.js';
import { extractDeclaredVariables } from '../transform/extract.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/execution.js').ExecutionError} ExecutionError
 * @typedef {import('../types/execution.js').DisplayData} DisplayData
 */

/**
 * Format a value for display as a string
 * @param {*} value
 * @param {number} [maxLength=1000]
 * @returns {string | undefined}
 */
function formatValue(value, maxLength = 1000) {
  if (value === undefined) return undefined;
  if (value === null) return 'null';

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value, null, 2);
      if (json.length > maxLength) {
        return json.slice(0, maxLength) + '...';
      }
      return json;
    } catch {
      return String(value);
    }
  }

  const str = String(value);
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + '...';
  }
  return str;
}

/**
 * JavaScript executor
 */
export class JavaScriptExecutor extends BaseExecutor {
  /** @type {readonly string[]} */
  languages = ['javascript', 'js', 'ecmascript', 'es'];

  /**
   * Execute JavaScript code
   * @param {string} code - Code to execute
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, context, options = {}) {
    const startTime = performance.now();

    // Extract and track declared variables
    const declaredVars = extractDeclaredVariables(code);
    for (const varName of declaredVars) {
      context.trackVariable(varName);
    }

    // Transform code for persistence (const/let → var)
    const transformed = transformForPersistence(code);

    // Wrap to capture last expression value and support async
    const wrapped = wrapWithLastExpression(transformed);

    try {
      // Execute in context (pass execId for input() support)
      const rawResult = await context.execute(wrapped, { execId: options.execId });
      const duration = performance.now() - startTime;

      // Format result
      return this.#formatResult(rawResult, context, duration, options);
    } catch (error) {
      const duration = performance.now() - startTime;

      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        error: this.#formatError(error),
        displayData: [],
        assets: [],
        executionCount: 0,
        duration,
      };
    }
  }

  /**
   * Format raw execution result to MRP ExecutionResult
   * @param {import('../session/context/interface.js').RawExecutionResult} raw
   * @param {ExecutionContext} context
   * @param {number} duration
   * @param {ExecuteOptions} options
   * @returns {ExecutionResult}
   */
  #formatResult(raw, context, duration, options) {
    // Separate logs into stdout/stderr
    const stdout = raw.logs
      .filter((log) => log.type === 'log' || log.type === 'info')
      .map((log) => log.args.map((arg) => formatValue(arg) ?? '').join(' '))
      .join('\n');

    const stderr = raw.logs
      .filter((log) => log.type === 'error' || log.type === 'warn')
      .map((log) => {
        const prefix = log.type === 'error' ? 'Error: ' : 'Warning: ';
        return prefix + log.args.map((arg) => formatValue(arg) ?? '').join(' ');
      })
      .join('\n');

    // Format error if present
    /** @type {ExecutionError | undefined} */
    let error;
    if (raw.error) {
      error = this.#formatError(raw.error);
    }

    // Get display data from context
    /** @type {DisplayData[]} */
    const displayData = 'getDisplayQueue' in context ? context.getDisplayQueue() : [];

    return {
      success: !raw.error,
      stdout,
      stderr,
      result: raw.result,
      resultString: formatValue(raw.result),
      error,
      displayData,
      assets: [],
      executionCount: 0, // Will be set by session
      duration,
    };
  }

  /**
   * Format an error
   * @param {*} error
   * @returns {ExecutionError}
   */
  #formatError(error) {
    if (error instanceof Error) {
      /** @type {ExecutionError} */
      const formatted = {
        type: error.name,
        message: error.message,
        traceback: error.stack?.split('\n'),
      };

      // Try to extract line/column from stack
      const lineMatch = error.stack?.match(/:(\d+):(\d+)/);
      if (lineMatch) {
        formatted.line = parseInt(lineMatch[1], 10);
        formatted.column = parseInt(lineMatch[2], 10);
      }

      return formatted;
    }

    return {
      type: 'Error',
      message: String(error),
    };
  }
}

/**
 * Create a JavaScript executor
 * @returns {JavaScriptExecutor}
 */
export function createJavaScriptExecutor() {
  return new JavaScriptExecutor();
}
