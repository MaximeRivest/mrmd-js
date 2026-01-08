/**
 * Executor Interface
 *
 * Defines the contract for language executors.
 * Each executor handles one or more languages and produces MRP-compliant results.
 *
 * @module execute/interface
 */

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/streaming.js').StreamEvent} StreamEvent
 */

/**
 * @typedef {Object} Executor
 * @property {readonly string[]} languages - Language identifiers this executor handles
 * @property {function(string, ExecutionContext, ExecuteOptions=): Promise<ExecutionResult>} execute - Execute code
 * @property {function(string, ExecutionContext, ExecuteOptions=): AsyncGenerator<StreamEvent>} [executeStream] - Execute with streaming
 */

/**
 * @typedef {Object} ExecutorConfig
 * @property {string[]} languages - Language identifiers to register
 */

/**
 * Base class for executors (optional, executors can also be plain objects)
 * @abstract
 */
export class BaseExecutor {
  /** @type {readonly string[]} */
  languages = [];

  /**
   * Execute code
   * @param {string} code - Code to execute
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {Promise<ExecutionResult>}
   * @abstract
   */
  async execute(code, context, options = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Execute code with streaming output
   * Default implementation wraps execute() result
   *
   * @param {string} code - Code to execute
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {AsyncGenerator<StreamEvent>}
   */
  async *executeStream(code, context, options = {}) {
    const execId = options.execId || `exec-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Start event
    yield /** @type {import('../types/streaming.js').StartEvent} */ ({
      type: 'start',
      execId,
      timestamp,
    });

    try {
      // Execute
      const result = await this.execute(code, context, options);

      // Stream stdout
      if (result.stdout) {
        yield /** @type {import('../types/streaming.js').StdoutEvent} */ ({
          type: 'stdout',
          content: result.stdout,
          accumulated: result.stdout,
        });
      }

      // Stream stderr
      if (result.stderr) {
        yield /** @type {import('../types/streaming.js').StderrEvent} */ ({
          type: 'stderr',
          content: result.stderr,
          accumulated: result.stderr,
        });
      }

      // Stream display data
      for (const display of result.displayData) {
        yield /** @type {import('../types/streaming.js').DisplayEvent} */ ({
          type: 'display',
          data: display.data,
          metadata: display.metadata,
        });
      }

      // Stream assets
      for (const asset of result.assets) {
        yield /** @type {import('../types/streaming.js').AssetEvent} */ ({
          type: 'asset',
          path: asset.path,
          url: asset.url,
          mimeType: asset.mimeType,
          assetType: asset.assetType,
        });
      }

      // Result event
      yield /** @type {import('../types/streaming.js').ResultEvent} */ ({
        type: 'result',
        result,
      });
    } catch (error) {
      // Error event
      yield /** @type {import('../types/streaming.js').ErrorEvent} */ ({
        type: 'error',
        error: {
          type: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          traceback: error instanceof Error && error.stack ? error.stack.split('\n') : undefined,
        },
      });
    }

    // Done event
    yield /** @type {import('../types/streaming.js').DoneEvent} */ ({
      type: 'done',
    });
  }

  /**
   * Check if this executor supports a language
   * @param {string} language
   * @returns {boolean}
   */
  supports(language) {
    return this.languages.includes(language.toLowerCase());
  }
}

export {};
