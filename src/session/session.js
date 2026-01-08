/**
 * Session Class
 *
 * A session is an isolated execution context that persists variables
 * across executions. It wraps an ExecutionContext and provides the
 * full MRP session API.
 *
 * @module session/session
 */

import { IframeContext } from './context/iframe.js';
import { MainContext } from './context/main.js';
import { extractDeclaredVariables } from '../transform/extract.js';
import { JavaScriptExecutor } from '../execute/javascript.js';

// LSP Features
import { getCompletions } from '../lsp/complete.js';
import { getHoverInfo } from '../lsp/hover.js';
import { getInspectInfo } from '../lsp/inspect.js';
import {
  listVariables as lspListVariables,
  getVariableDetail as lspGetVariableDetail,
} from '../lsp/variables.js';

// Analysis Features
import { isComplete as analysisIsComplete } from '../analysis/is-complete.js';
import { formatCode } from '../analysis/format.js';

/**
 * @typedef {import('../execute/registry.js').ExecutorRegistry} ExecutorRegistry
 * @typedef {import('../execute/interface.js').Executor} Executor
 */

/**
 * @typedef {import('./context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('./context/interface.js').RawExecutionResult} RawExecutionResult
 * @typedef {import('../types/session.js').SessionInfo} SessionInfo
 * @typedef {import('../types/session.js').CreateSessionOptions} CreateSessionOptions
 * @typedef {import('../types/session.js').IsolationMode} IsolationMode
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/execution.js').ExecutionError} ExecutionError
 * @typedef {import('../types/execution.js').DisplayData} DisplayData
 * @typedef {import('../types/streaming.js').StreamEvent} StreamEvent
 * @typedef {import('../types/completion.js').CompleteOptions} CompleteOptions
 * @typedef {import('../types/completion.js').CompletionResult} CompletionResult
 * @typedef {import('../types/inspection.js').InspectOptions} InspectOptions
 * @typedef {import('../types/inspection.js').InspectResult} InspectResult
 * @typedef {import('../types/inspection.js').HoverResult} HoverResult
 * @typedef {import('../types/variables.js').VariableFilter} VariableFilter
 * @typedef {import('../types/variables.js').VariableInfo} VariableInfo
 * @typedef {import('../types/variables.js').VariableDetailOptions} VariableDetailOptions
 * @typedef {import('../types/variables.js').VariableDetail} VariableDetail
 * @typedef {import('../types/analysis.js').IsCompleteResult} IsCompleteResult
 * @typedef {import('../types/analysis.js').FormatResult} FormatResult
 */

/**
 * Generate a unique execution ID
 * @returns {string}
 */
function generateExecId() {
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Session class - represents an isolated execution context
 */
export class Session {
  /** @type {string} */
  #id;

  /** @type {string} */
  #language;

  /** @type {IsolationMode} */
  #isolation;

  /** @type {Date} */
  #created;

  /** @type {Date} */
  #lastActivity;

  /** @type {number} */
  #executionCount = 0;

  /** @type {ExecutionContext} */
  #context;

  /** @type {ExecutorRegistry | null} */
  #executorRegistry = null;

  /** @type {JavaScriptExecutor} */
  #defaultJsExecutor;

  /** @type {Map<string, AbortController>} */
  #runningExecutions = new Map();

  /** @type {Map<string, (text: string) => void>} */
  #pendingInputs = new Map();

  /**
   * @param {string} id - Session ID
   * @param {CreateSessionOptions & { executorRegistry?: ExecutorRegistry }} [options]
   */
  constructor(id, options = {}) {
    this.#id = id;
    this.#language = options.language || 'javascript';
    this.#isolation = options.isolation || 'iframe';
    this.#created = new Date();
    this.#lastActivity = new Date();

    // Store executor registry if provided
    this.#executorRegistry = options.executorRegistry || null;

    // Create default JS executor for fallback
    this.#defaultJsExecutor = new JavaScriptExecutor();

    // Create the appropriate context
    this.#context = this.#createContext(options);
  }

  /**
   * Create the execution context based on isolation mode
   * @param {CreateSessionOptions} options
   * @returns {ExecutionContext}
   */
  #createContext(options) {
    switch (this.#isolation) {
      case 'none':
        return new MainContext({
          utilities: options.utilities,
        });

      case 'iframe':
      default:
        return new IframeContext({
          visible: false,
          allowMainAccess: options.allowMainAccess ?? false,
          utilities: options.utilities,
        });
    }
  }

  // ============================================================================
  // Properties
  // ============================================================================

  /** @returns {string} */
  get id() {
    return this.#id;
  }

  /** @returns {string} */
  get language() {
    return this.#language;
  }

  /** @returns {IsolationMode} */
  get isolation() {
    return this.#isolation;
  }

  /** @returns {Date} */
  get created() {
    return this.#created;
  }

  /** @returns {Date} */
  get lastActivity() {
    return this.#lastActivity;
  }

  /** @returns {number} */
  get executionCount() {
    return this.#executionCount;
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Execute code and return result
   * @param {string} code - Code to execute
   * @param {ExecuteOptions} [options]
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, options = {}) {
    const execId = options.execId || generateExecId();
    const language = options.language || this.#language;

    // Update activity
    this.#lastActivity = new Date();

    // Track execution
    const abortController = new AbortController();
    this.#runningExecutions.set(execId, abortController);

    try {
      // Get the executor for this language
      const executor = this.#getExecutor(language);

      // Execute using the executor
      const result = await executor.execute(code, this.#context, {
        ...options,
        execId,
        language,
      });

      // Update execution count
      if (options.storeHistory !== false) {
        this.#executionCount++;
      }

      // Update result with session's execution count
      result.executionCount = this.#executionCount;

      return result;
    } finally {
      this.#runningExecutions.delete(execId);
    }
  }

  /**
   * Get the executor for a language
   * @param {string} language
   * @returns {Executor}
   */
  #getExecutor(language) {
    // Try registry first
    if (this.#executorRegistry) {
      const executor = this.#executorRegistry.get(language);
      if (executor) return executor;
    }

    // Fall back to default JS executor for JavaScript
    const lang = language.toLowerCase();
    if (['javascript', 'js', 'ecmascript', 'es'].includes(lang)) {
      return this.#defaultJsExecutor;
    }

    // Return a no-op executor that reports unsupported language
    return {
      languages: [],
      async execute(code, context, options) {
        return {
          success: false,
          stdout: '',
          stderr: `No executor registered for language: ${language}`,
          error: {
            type: 'ExecutorError',
            message: `No executor registered for language: ${language}. Register an ExecutorRegistry with HTML/CSS executors to support this language.`,
          },
          displayData: [],
          assets: [],
          executionCount: 0,
          duration: 0,
        };
      },
    };
  }

  /**
   * Execute code with streaming output
   * @param {string} code - Code to execute
   * @param {ExecuteOptions} [options]
   * @returns {AsyncGenerator<StreamEvent>}
   */
  async *executeStream(code, options = {}) {
    const execId = options.execId || generateExecId();
    const language = options.language || this.#language;

    // Update activity
    this.#lastActivity = new Date();

    // Track execution
    const abortController = new AbortController();
    this.#runningExecutions.set(execId, abortController);

    try {
      // Get the executor for this language
      const executor = this.#getExecutor(language);

      // Use executor's streaming if available
      if (executor.executeStream) {
        let executionCount = this.#executionCount;

        for await (const event of executor.executeStream(code, this.#context, {
          ...options,
          execId,
          language,
        })) {
          // Update execution count on result event
          if (event.type === 'result' && options.storeHistory !== false) {
            this.#executionCount++;
            event.result.executionCount = this.#executionCount;
          }
          yield event;
        }
      } else {
        // Fall back to wrapping execute()
        const timestamp = new Date().toISOString();

        yield /** @type {import('../types/streaming.js').StartEvent} */ ({
          type: 'start',
          execId,
          timestamp,
        });

        try {
          const result = await executor.execute(code, this.#context, {
            ...options,
            execId,
            language,
          });

          if (options.storeHistory !== false) {
            this.#executionCount++;
          }
          result.executionCount = this.#executionCount;

          if (result.stdout) {
            yield /** @type {import('../types/streaming.js').StdoutEvent} */ ({
              type: 'stdout',
              content: result.stdout,
              accumulated: result.stdout,
            });
          }

          if (result.stderr) {
            yield /** @type {import('../types/streaming.js').StderrEvent} */ ({
              type: 'stderr',
              content: result.stderr,
              accumulated: result.stderr,
            });
          }

          for (const display of result.displayData) {
            yield /** @type {import('../types/streaming.js').DisplayEvent} */ ({
              type: 'display',
              data: display.data,
              metadata: display.metadata,
            });
          }

          for (const asset of result.assets) {
            yield /** @type {import('../types/streaming.js').AssetEvent} */ ({
              type: 'asset',
              path: asset.path,
              url: asset.url,
              mimeType: asset.mimeType,
              assetType: asset.assetType,
            });
          }

          yield /** @type {import('../types/streaming.js').ResultEvent} */ ({
            type: 'result',
            result,
          });
        } catch (error) {
          yield /** @type {import('../types/streaming.js').ErrorEvent} */ ({
            type: 'error',
            error: {
              type: error instanceof Error ? error.name : 'Error',
              message: error instanceof Error ? error.message : String(error),
              traceback: error instanceof Error && error.stack ? error.stack.split('\n') : undefined,
            },
          });
        }

        yield /** @type {import('../types/streaming.js').DoneEvent} */ ({
          type: 'done',
        });
      }
    } finally {
      this.#runningExecutions.delete(execId);
    }
  }

  /**
   * Set the executor registry
   * @param {ExecutorRegistry} registry
   */
  setExecutorRegistry(registry) {
    this.#executorRegistry = registry;
  }

  /**
   * Get the executor registry
   * @returns {ExecutorRegistry | null}
   */
  getExecutorRegistry() {
    return this.#executorRegistry;
  }

  /**
   * Get supported languages
   * @returns {string[]}
   */
  getSupportedLanguages() {
    if (this.#executorRegistry) {
      return this.#executorRegistry.languages();
    }
    return ['javascript', 'js', 'ecmascript', 'es'];
  }

  /**
   * Send input to a waiting execution
   * @param {string} execId - Execution ID
   * @param {string} text - Input text
   * @returns {boolean} Whether input was accepted
   */
  sendInput(execId, text) {
    const handler = this.#pendingInputs.get(execId);
    if (handler) {
      handler(text);
      this.#pendingInputs.delete(execId);
      return true;
    }
    return false;
  }

  /**
   * Interrupt a running execution
   * @param {string} [execId] - Specific execution ID, or all if not provided
   * @returns {boolean} Whether any execution was interrupted
   */
  interrupt(execId) {
    if (execId) {
      const controller = this.#runningExecutions.get(execId);
      if (controller) {
        controller.abort();
        this.#runningExecutions.delete(execId);
        return true;
      }
      return false;
    }

    // Interrupt all
    if (this.#runningExecutions.size > 0) {
      for (const controller of this.#runningExecutions.values()) {
        controller.abort();
      }
      this.#runningExecutions.clear();
      return true;
    }

    return false;
  }

  // ============================================================================
  // LSP Features (delegated to lsp/ modules)
  // ============================================================================

  /**
   * Get completions at cursor position
   * @param {string} code
   * @param {number} cursor
   * @param {CompleteOptions} [options]
   * @returns {CompletionResult}
   */
  complete(code, cursor, options = {}) {
    return getCompletions(code, cursor, this.#context, options);
  }

  /**
   * Get hover information at cursor position
   * @param {string} code
   * @param {number} cursor
   * @returns {HoverResult}
   */
  hover(code, cursor) {
    return getHoverInfo(code, cursor, this.#context);
  }

  /**
   * Get detailed inspection at cursor position
   * @param {string} code
   * @param {number} cursor
   * @param {InspectOptions} [options]
   * @returns {InspectResult}
   */
  inspect(code, cursor, options = {}) {
    return getInspectInfo(code, cursor, this.#context, options);
  }

  /**
   * List all variables in session
   * @param {VariableFilter} [filter]
   * @returns {VariableInfo[]}
   */
  listVariables(filter = {}) {
    return lspListVariables(this.#context, filter);
  }

  /**
   * Get detailed information about a variable
   * @param {string} name
   * @param {VariableDetailOptions} [options]
   * @returns {VariableDetail | null}
   */
  getVariable(name, options = {}) {
    return lspGetVariableDetail(name, this.#context, options);
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Check if code is a complete statement
   * @param {string} code
   * @returns {IsCompleteResult}
   */
  isComplete(code) {
    return analysisIsComplete(code);
  }

  /**
   * Format code
   * @param {string} code
   * @returns {Promise<FormatResult>}
   */
  async format(code) {
    return formatCode(code);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Reset the session (clear variables but keep session)
   */
  reset() {
    this.#context.reset();
    this.#executionCount = 0;
    this.#lastActivity = new Date();
  }

  /**
   * Destroy the session and release resources
   */
  destroy() {
    // Cancel any running executions
    this.interrupt();

    // Destroy context
    this.#context.destroy();
  }

  /**
   * Get session info
   * @returns {SessionInfo}
   */
  getInfo() {
    return {
      id: this.#id,
      language: this.#language,
      created: this.#created.toISOString(),
      lastActivity: this.#lastActivity.toISOString(),
      executionCount: this.#executionCount,
      variableCount: this.#context.getTrackedVariables().size,
      isolation: this.#isolation,
    };
  }

  /**
   * Get the underlying execution context (for advanced use)
   * @returns {ExecutionContext}
   */
  getContext() {
    return this.#context;
  }
}

/**
 * Create a session
 * @param {string} id
 * @param {CreateSessionOptions} [options]
 * @returns {Session}
 */
export function createSession(id, options) {
  return new Session(id, options);
}
