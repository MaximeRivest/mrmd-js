/**
 * Executor Registry
 *
 * Manages language executors and routes execution requests
 * to the appropriate executor based on language.
 *
 * @module execute/registry
 */

/**
 * @typedef {import('./interface.js').Executor} Executor
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/streaming.js').StreamEvent} StreamEvent
 */

/**
 * Registry for language executors
 */
export class ExecutorRegistry {
  /** @type {Map<string, Executor>} */
  #executors = new Map();

  /** @type {Map<string, string>} */
  #aliases = new Map();

  /**
   * Register an executor for one or more languages
   * @param {Executor} executor - The executor to register
   */
  register(executor) {
    for (const language of executor.languages) {
      const lang = language.toLowerCase();
      this.#executors.set(lang, executor);
    }
  }

  /**
   * Register a single language with an executor
   * @param {string} language - Language identifier
   * @param {Executor} executor - The executor
   */
  registerLanguage(language, executor) {
    this.#executors.set(language.toLowerCase(), executor);
  }

  /**
   * Register an alias for a language
   * @param {string} alias - The alias
   * @param {string} language - The target language
   */
  registerAlias(alias, language) {
    this.#aliases.set(alias.toLowerCase(), language.toLowerCase());
  }

  /**
   * Get the executor for a language
   * @param {string} language
   * @returns {Executor | undefined}
   */
  get(language) {
    const lang = language.toLowerCase();

    // Check direct registration
    let executor = this.#executors.get(lang);
    if (executor) return executor;

    // Check aliases
    const aliasTarget = this.#aliases.get(lang);
    if (aliasTarget) {
      return this.#executors.get(aliasTarget);
    }

    return undefined;
  }

  /**
   * Check if a language is supported
   * @param {string} language
   * @returns {boolean}
   */
  supports(language) {
    return this.get(language) !== undefined;
  }

  /**
   * Get all registered languages
   * @returns {string[]}
   */
  languages() {
    const langs = new Set([...this.#executors.keys(), ...this.#aliases.keys()]);
    return Array.from(langs).sort();
  }

  /**
   * Get all registered executors (deduplicated)
   * @returns {Executor[]}
   */
  executors() {
    return Array.from(new Set(this.#executors.values()));
  }

  /**
   * Execute code using the appropriate executor
   * @param {string} code - Code to execute
   * @param {string} language - Language identifier
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, language, context, options = {}) {
    const executor = this.get(language);

    if (!executor) {
      return {
        success: false,
        stdout: '',
        stderr: `No executor registered for language: ${language}`,
        error: {
          type: 'ExecutorError',
          message: `No executor registered for language: ${language}`,
        },
        displayData: [],
        assets: [],
        executionCount: 0,
        duration: 0,
      };
    }

    return executor.execute(code, context, options);
  }

  /**
   * Execute code with streaming using the appropriate executor
   * @param {string} code - Code to execute
   * @param {string} language - Language identifier
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {AsyncGenerator<StreamEvent>}
   */
  async *executeStream(code, language, context, options = {}) {
    const executor = this.get(language);

    if (!executor) {
      yield /** @type {import('../types/streaming.js').ErrorEvent} */ ({
        type: 'error',
        error: {
          type: 'ExecutorError',
          message: `No executor registered for language: ${language}`,
        },
      });
      yield /** @type {import('../types/streaming.js').DoneEvent} */ ({
        type: 'done',
      });
      return;
    }

    if (executor.executeStream) {
      yield* executor.executeStream(code, context, options);
    } else {
      // Fall back to non-streaming execution wrapped in events
      const execId = options.execId || `exec-${Date.now()}`;

      yield /** @type {import('../types/streaming.js').StartEvent} */ ({
        type: 'start',
        execId,
        timestamp: new Date().toISOString(),
      });

      try {
        const result = await executor.execute(code, context, options);

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
          },
        });
      }

      yield /** @type {import('../types/streaming.js').DoneEvent} */ ({
        type: 'done',
      });
    }
  }

  /**
   * Unregister a language
   * @param {string} language
   * @returns {boolean}
   */
  unregister(language) {
    const lang = language.toLowerCase();
    const hadExecutor = this.#executors.delete(lang);
    const hadAlias = this.#aliases.delete(lang);
    return hadExecutor || hadAlias;
  }

  /**
   * Clear all registered executors
   */
  clear() {
    this.#executors.clear();
    this.#aliases.clear();
  }
}

/**
 * Create an executor registry
 * @returns {ExecutorRegistry}
 */
export function createExecutorRegistry() {
  return new ExecutorRegistry();
}
