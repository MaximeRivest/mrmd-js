/**
 * Session Manager
 *
 * Manages multiple sessions, handles creation/destruction,
 * and enforces limits.
 *
 * @module session/manager
 */

import { Session } from './session.js';

/**
 * @typedef {import('../types/session.js').SessionInfo} SessionInfo
 * @typedef {import('../types/session.js').CreateSessionOptions} CreateSessionOptions
 */

/**
 * @typedef {Object} SessionManagerOptions
 * @property {number} [maxSessions=10] - Maximum number of concurrent sessions
 * @property {string} [defaultLanguage='javascript'] - Default language for new sessions
 * @property {import('../types/session.js').IsolationMode} [defaultIsolation='iframe'] - Default isolation mode
 * @property {boolean} [defaultAllowMainAccess=false] - Default main access setting
 */

/**
 * Generate a unique session ID
 * @returns {string}
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Session Manager - manages multiple execution sessions
 */
export class SessionManager {
  /** @type {Map<string, Session>} */
  #sessions = new Map();

  /** @type {SessionManagerOptions} */
  #options;

  /**
   * @param {SessionManagerOptions} [options]
   */
  constructor(options = {}) {
    this.#options = {
      maxSessions: 10,
      defaultLanguage: 'javascript',
      defaultIsolation: 'iframe',
      defaultAllowMainAccess: false,
      ...options,
    };
  }

  // ============================================================================
  // Session Lifecycle
  // ============================================================================

  /**
   * Create a new session
   * @param {CreateSessionOptions} [options]
   * @returns {Session}
   * @throws {Error} If max sessions reached
   */
  create(options = {}) {
    // Check limits
    if (this.#sessions.size >= this.#options.maxSessions) {
      throw new Error(
        `Maximum sessions (${this.#options.maxSessions}) reached. ` +
          'Destroy existing sessions before creating new ones.'
      );
    }

    // Generate ID if not provided
    const id = options.id || generateSessionId();

    // Check for duplicate ID
    if (this.#sessions.has(id)) {
      throw new Error(`Session with ID '${id}' already exists`);
    }

    // Merge with defaults
    const sessionOptions = {
      language: options.language || this.#options.defaultLanguage,
      isolation: options.isolation || this.#options.defaultIsolation,
      allowMainAccess: options.allowMainAccess ?? this.#options.defaultAllowMainAccess,
      utilities: options.utilities,
    };

    // Create session
    const session = new Session(id, sessionOptions);
    this.#sessions.set(id, session);

    return session;
  }

  /**
   * Get an existing session by ID
   * @param {string} id
   * @returns {Session | undefined}
   */
  get(id) {
    return this.#sessions.get(id);
  }

  /**
   * Get a session, creating it if it doesn't exist
   * @param {string} id
   * @param {CreateSessionOptions} [options]
   * @returns {Session}
   */
  getOrCreate(id, options = {}) {
    const existing = this.#sessions.get(id);
    if (existing) {
      return existing;
    }
    return this.create({ ...options, id });
  }

  /**
   * Check if a session exists
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#sessions.has(id);
  }

  /**
   * Destroy a session by ID
   * @param {string} id
   * @returns {boolean} Whether a session was destroyed
   */
  destroy(id) {
    const session = this.#sessions.get(id);
    if (session) {
      session.destroy();
      this.#sessions.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Destroy all sessions
   */
  destroyAll() {
    for (const session of this.#sessions.values()) {
      session.destroy();
    }
    this.#sessions.clear();
  }

  // ============================================================================
  // Session Queries
  // ============================================================================

  /**
   * List all sessions
   * @returns {SessionInfo[]}
   */
  list() {
    return Array.from(this.#sessions.values()).map((s) => s.getInfo());
  }

  /**
   * Get number of active sessions
   * @returns {number}
   */
  get size() {
    return this.#sessions.size;
  }

  /**
   * Get all session IDs
   * @returns {string[]}
   */
  get ids() {
    return Array.from(this.#sessions.keys());
  }

  /**
   * Get the maximum number of sessions allowed
   * @returns {number}
   */
  get maxSessions() {
    return this.#options.maxSessions;
  }

  /**
   * Iterate over sessions
   * @returns {IterableIterator<Session>}
   */
  [Symbol.iterator]() {
    return this.#sessions.values();
  }

  /**
   * Iterate over session entries
   * @returns {IterableIterator<[string, Session]>}
   */
  entries() {
    return this.#sessions.entries();
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Reset all sessions (clear variables but keep sessions)
   */
  resetAll() {
    for (const session of this.#sessions.values()) {
      session.reset();
    }
  }

  /**
   * Interrupt all running executions across all sessions
   * @returns {number} Number of sessions that had executions interrupted
   */
  interruptAll() {
    let count = 0;
    for (const session of this.#sessions.values()) {
      if (session.interrupt()) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get sessions by language
   * @param {string} language
   * @returns {Session[]}
   */
  getByLanguage(language) {
    const results = [];
    for (const session of this.#sessions.values()) {
      if (session.language === language) {
        results.push(session);
      }
    }
    return results;
  }

  /**
   * Get the most recently active session
   * @returns {Session | undefined}
   */
  getMostRecent() {
    let mostRecent = undefined;
    let latestTime = 0;

    for (const session of this.#sessions.values()) {
      const time = session.lastActivity.getTime();
      if (time > latestTime) {
        latestTime = time;
        mostRecent = session;
      }
    }

    return mostRecent;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy sessions that have been inactive for a certain time
   * @param {number} maxIdleMs - Maximum idle time in milliseconds
   * @returns {number} Number of sessions destroyed
   */
  cleanupIdle(maxIdleMs) {
    const now = Date.now();
    const toDestroy = [];

    for (const [id, session] of this.#sessions) {
      if (now - session.lastActivity.getTime() > maxIdleMs) {
        toDestroy.push(id);
      }
    }

    for (const id of toDestroy) {
      this.destroy(id);
    }

    return toDestroy.length;
  }

  /**
   * Destroy oldest sessions to get under a certain count
   * @param {number} targetCount - Target number of sessions
   * @returns {number} Number of sessions destroyed
   */
  trimToCount(targetCount) {
    if (this.#sessions.size <= targetCount) {
      return 0;
    }

    // Sort by last activity (oldest first)
    const sorted = Array.from(this.#sessions.entries()).sort(
      ([, a], [, b]) => a.lastActivity.getTime() - b.lastActivity.getTime()
    );

    const toDestroy = sorted.slice(0, this.#sessions.size - targetCount);

    for (const [id] of toDestroy) {
      this.destroy(id);
    }

    return toDestroy.length;
  }
}

/**
 * Create a session manager
 * @param {SessionManagerOptions} [options]
 * @returns {SessionManager}
 */
export function createSessionManager(options) {
  return new SessionManager(options);
}
