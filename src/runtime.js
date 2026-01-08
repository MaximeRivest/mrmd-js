/**
 * MRP Runtime
 *
 * Main entry point for the mrmd-js runtime. Implements the MRMD Runtime
 * Protocol (MRP) as a JavaScript API for browser-based execution.
 *
 * @module runtime
 */

import { SessionManager } from './session/manager.js';
import { createDefaultExecutorRegistry } from './execute/index.js';
import { RUNTIME_NAME, RUNTIME_VERSION, DEFAULT_MAX_SESSIONS } from './constants.js';

/**
 * @typedef {import('./types/capabilities.js').Capabilities} Capabilities
 * @typedef {import('./types/capabilities.js').Features} Features
 * @typedef {import('./types/capabilities.js').BrowserEnvironment} BrowserEnvironment
 * @typedef {import('./types/session.js').SessionInfo} SessionInfo
 * @typedef {import('./types/session.js').CreateSessionOptions} CreateSessionOptions
 * @typedef {import('./types/session.js').IsolationMode} IsolationMode
 * @typedef {import('./types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('./types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('./types/streaming.js').StreamEvent} StreamEvent
 * @typedef {import('./types/completion.js').CompleteOptions} CompleteOptions
 * @typedef {import('./types/completion.js').CompletionResult} CompletionResult
 * @typedef {import('./types/inspection.js').InspectOptions} InspectOptions
 * @typedef {import('./types/inspection.js').InspectResult} InspectResult
 * @typedef {import('./types/inspection.js').HoverResult} HoverResult
 * @typedef {import('./types/variables.js').VariableFilter} VariableFilter
 * @typedef {import('./types/variables.js').VariableInfo} VariableInfo
 * @typedef {import('./types/variables.js').VariableDetailOptions} VariableDetailOptions
 * @typedef {import('./types/variables.js').VariableDetail} VariableDetail
 * @typedef {import('./types/analysis.js').IsCompleteResult} IsCompleteResult
 * @typedef {import('./types/analysis.js').FormatResult} FormatResult
 * @typedef {import('./session/session.js').Session} Session
 * @typedef {import('./execute/registry.js').ExecutorRegistry} ExecutorRegistry
 * @typedef {import('./execute/interface.js').Executor} Executor
 */

/**
 * @typedef {Object} MrpRuntimeOptions
 * @property {number} [maxSessions] - Maximum concurrent sessions
 * @property {IsolationMode} [defaultIsolation='iframe'] - Default isolation mode
 * @property {boolean} [defaultAllowMainAccess=false] - Allow main window access by default
 */

/**
 * Asset stored in the runtime
 * @typedef {Object} StoredAsset
 * @property {string} url - Blob URL
 * @property {string} mimeType - MIME type
 * @property {string} assetType - Asset type category
 * @property {number} size - Size in bytes
 */

/**
 * Main MRP runtime for browser JavaScript
 *
 * @example
 * const runtime = new MrpRuntime();
 * const session = runtime.createSession({ language: 'javascript' });
 * const result = await session.execute('const x = 1 + 2; x');
 * console.log(result.resultString); // "3"
 */
export class MrpRuntime {
  /** @type {SessionManager} */
  #sessionManager;

  /** @type {ExecutorRegistry} */
  #executorRegistry;

  /** @type {MrpRuntimeOptions} */
  #options;

  /** @type {Map<string, StoredAsset>} */
  #assets = new Map();

  /**
   * Create a new MRP runtime
   * @param {MrpRuntimeOptions} [options]
   */
  constructor(options = {}) {
    this.#options = {
      maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
      defaultIsolation: options.defaultIsolation ?? 'iframe',
      defaultAllowMainAccess: options.defaultAllowMainAccess ?? false,
    };

    this.#executorRegistry = createDefaultExecutorRegistry();
    this.#sessionManager = new SessionManager({
      maxSessions: this.#options.maxSessions,
    });
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  /**
   * Get runtime capabilities (MRP /capabilities)
   * @returns {Capabilities}
   */
  getCapabilities() {
    return {
      runtime: RUNTIME_NAME,
      version: RUNTIME_VERSION,
      languages: this.#executorRegistry.languages(),
      features: this.#getFeatures(),
      defaultSession: 'default',
      maxSessions: this.#options.maxSessions ?? DEFAULT_MAX_SESSIONS,
      environment: this.#getEnvironment(),
    };
  }

  /**
   * Get feature flags
   * @returns {Features}
   */
  #getFeatures() {
    return {
      execute: true,
      executeStream: true,
      interrupt: true,
      complete: true,
      inspect: true,
      hover: true,
      variables: true,
      variableExpand: true,
      reset: true,
      isComplete: true,
      format: true,
      assets: true,
    };
  }

  /**
   * Get environment info
   * @returns {BrowserEnvironment}
   */
  #getEnvironment() {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'en',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    };
  }

  // ============================================================================
  // Sessions
  // ============================================================================

  /**
   * List all active sessions (MRP GET /sessions)
   * @returns {SessionInfo[]}
   */
  listSessions() {
    return this.#sessionManager.list();
  }

  /**
   * Create a new session (MRP POST /sessions)
   * @param {CreateSessionOptions} [options]
   * @returns {Session}
   */
  createSession(options = {}) {
    const session = this.#sessionManager.create({
      ...options,
      isolation: options.isolation ?? this.#options.defaultIsolation,
      allowMainAccess: options.allowMainAccess ?? this.#options.defaultAllowMainAccess,
      executorRegistry: this.#executorRegistry,
    });
    return session;
  }

  /**
   * Get a session by ID (MRP GET /sessions/{id})
   * @param {string} id
   * @returns {Session | undefined}
   */
  getSession(id) {
    return this.#sessionManager.get(id);
  }

  /**
   * Get or create a session
   * @param {string} id
   * @param {CreateSessionOptions} [options]
   * @returns {Session}
   */
  getOrCreateSession(id, options = {}) {
    const existing = this.#sessionManager.get(id);
    if (existing) return existing;

    return this.createSession({ ...options, id });
  }

  /**
   * Destroy a session (MRP DELETE /sessions/{id})
   * @param {string} id
   * @returns {boolean}
   */
  destroySession(id) {
    return this.#sessionManager.destroy(id);
  }

  /**
   * Reset a session (MRP POST /sessions/{id}/reset)
   * @param {string} id
   * @returns {boolean}
   */
  resetSession(id) {
    const session = this.#sessionManager.get(id);
    if (!session) return false;
    session.reset();
    return true;
  }

  // ============================================================================
  // Execution (convenience methods using default session)
  // ============================================================================

  /**
   * Execute code (MRP POST /execute)
   * @param {string} code
   * @param {ExecuteOptions} [options]
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, options = {}) {
    const session = this.getOrCreateSession(options.session ?? 'default');
    return session.execute(code, options);
  }

  /**
   * Execute code with streaming output (MRP POST /execute/stream)
   * @param {string} code
   * @param {ExecuteOptions} [options]
   * @returns {AsyncGenerator<StreamEvent>}
   */
  async *executeStream(code, options = {}) {
    const session = this.getOrCreateSession(options.session ?? 'default');
    yield* session.executeStream(code, options);
  }

  /**
   * Send input to a waiting execution (MRP POST /input)
   * @param {string} sessionId
   * @param {string} execId
   * @param {string} text
   * @returns {boolean}
   */
  sendInput(sessionId, execId, text) {
    const session = this.#sessionManager.get(sessionId);
    if (!session) return false;
    return session.sendInput(execId, text);
  }

  /**
   * Interrupt execution (MRP POST /interrupt)
   * @param {string} [sessionId]
   * @param {string} [execId]
   * @returns {boolean}
   */
  interrupt(sessionId, execId) {
    if (sessionId) {
      const session = this.#sessionManager.get(sessionId);
      if (!session) return false;
      return session.interrupt(execId);
    }

    // Interrupt all sessions
    return this.#sessionManager.interruptAll();
  }

  // ============================================================================
  // LSP Features (convenience methods)
  // ============================================================================

  /**
   * Get completions (MRP POST /complete)
   * @param {string} code
   * @param {number} cursor
   * @param {CompleteOptions} [options]
   * @returns {CompletionResult}
   */
  complete(code, cursor, options = {}) {
    const session = this.getOrCreateSession(options.session ?? 'default');
    return session.complete(code, cursor, options);
  }

  /**
   * Get hover info (MRP POST /hover)
   * @param {string} code
   * @param {number} cursor
   * @param {string} [sessionId='default']
   * @returns {HoverResult}
   */
  hover(code, cursor, sessionId = 'default') {
    const session = this.getOrCreateSession(sessionId);
    return session.hover(code, cursor);
  }

  /**
   * Get inspection info (MRP POST /inspect)
   * @param {string} code
   * @param {number} cursor
   * @param {InspectOptions} [options]
   * @returns {InspectResult}
   */
  inspect(code, cursor, options = {}) {
    const session = this.getOrCreateSession(options.session ?? 'default');
    return session.inspect(code, cursor, options);
  }

  /**
   * List variables (MRP POST /variables)
   * @param {VariableFilter} [filter]
   * @param {string} [sessionId='default']
   * @returns {VariableInfo[]}
   */
  listVariables(filter, sessionId = 'default') {
    const session = this.getOrCreateSession(sessionId);
    return session.listVariables(filter);
  }

  /**
   * Get variable detail (MRP POST /variables/{name})
   * @param {string} name
   * @param {VariableDetailOptions} [options]
   * @returns {VariableDetail | null}
   */
  getVariable(name, options = {}) {
    const session = this.getOrCreateSession(options.session ?? 'default');
    return session.getVariable(name, options);
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Check if code is complete (MRP POST /is_complete)
   * @param {string} code
   * @param {string} [sessionId='default']
   * @returns {IsCompleteResult}
   */
  isComplete(code, sessionId = 'default') {
    const session = this.getOrCreateSession(sessionId);
    return session.isComplete(code);
  }

  /**
   * Format code (MRP POST /format)
   * @param {string} code
   * @param {string} [sessionId='default']
   * @returns {Promise<FormatResult>}
   */
  async format(code, sessionId = 'default') {
    const session = this.getOrCreateSession(sessionId);
    return session.format(code);
  }

  // ============================================================================
  // Assets
  // ============================================================================

  /**
   * Create an asset (blob URL)
   * @param {Blob | string} content
   * @param {string} mimeType
   * @param {string} [name]
   * @returns {import('./types/execution.js').Asset}
   */
  createAsset(content, mimeType, name) {
    const blob = typeof content === 'string'
      ? new Blob([content], { type: mimeType })
      : content;

    const url = URL.createObjectURL(blob);
    const path = name ?? `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const assetType = mimeType.startsWith('image/')
      ? 'image'
      : mimeType === 'text/html'
        ? 'html'
        : mimeType === 'application/json'
          ? 'json'
          : 'other';

    this.#assets.set(path, {
      url,
      mimeType,
      assetType,
      size: blob.size,
    });

    return {
      path,
      url,
      mimeType,
      assetType,
      size: blob.size,
    };
  }

  /**
   * Get an asset by path (MRP GET /assets/{path})
   * @param {string} path
   * @returns {string | null} Blob URL or null if not found
   */
  getAsset(path) {
    const asset = this.#assets.get(path);
    return asset?.url ?? null;
  }

  /**
   * Get asset info
   * @param {string} path
   * @returns {StoredAsset | null}
   */
  getAssetInfo(path) {
    return this.#assets.get(path) ?? null;
  }

  /**
   * List all assets
   * @returns {Array<{ path: string } & StoredAsset>}
   */
  listAssets() {
    return Array.from(this.#assets.entries()).map(([path, asset]) => ({
      path,
      ...asset,
    }));
  }

  /**
   * Remove an asset
   * @param {string} path
   * @returns {boolean}
   */
  removeAsset(path) {
    const asset = this.#assets.get(path);
    if (!asset) return false;

    URL.revokeObjectURL(asset.url);
    this.#assets.delete(path);
    return true;
  }

  /**
   * Clear all assets
   */
  clearAssets() {
    for (const asset of this.#assets.values()) {
      URL.revokeObjectURL(asset.url);
    }
    this.#assets.clear();
  }

  // ============================================================================
  // Extensibility
  // ============================================================================

  /**
   * Register a custom executor for a language
   * @param {string} language
   * @param {Executor} executor
   */
  registerExecutor(language, executor) {
    this.#executorRegistry.register(language, executor);
  }

  /**
   * Register a language alias
   * @param {string} alias
   * @param {string} language
   */
  registerLanguageAlias(alias, language) {
    this.#executorRegistry.registerAlias(alias, language);
  }

  /**
   * Get the executor registry
   * @returns {ExecutorRegistry}
   */
  getExecutorRegistry() {
    return this.#executorRegistry;
  }

  /**
   * Get the session manager
   * @returns {SessionManager}
   */
  getSessionManager() {
    return this.#sessionManager;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Destroy the runtime and clean up all resources
   */
  destroy() {
    this.#sessionManager.destroyAll();
    this.clearAssets();
  }
}

/**
 * Create a new MRP runtime
 * @param {MrpRuntimeOptions} [options]
 * @returns {MrpRuntime}
 */
export function createRuntime(options) {
  return new MrpRuntime(options);
}
