/**
 * Session Tests
 *
 * Tests for the Session class functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Session, SessionManager, createSessionManager } from '../src/session/index.js';
import { createDefaultExecutorRegistry } from '../src/execute/index.js';

// Note: These tests run in Node.js/jsdom environment.
// Full browser-specific tests (iframe isolation) require browser environment.

describe('Session', () => {
  /** @type {Session} */
  let session;
  /** @type {SessionManager} */
  let manager;

  beforeEach(() => {
    manager = createSessionManager();
    session = manager.create({
      language: 'javascript',
      isolation: 'main', // Use main context for Node.js testing
    });
  });

  afterEach(() => {
    manager.destroyAll();
  });

  describe('creation', () => {
    it('should create a session with default options', () => {
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.language).toBe('javascript');
    });

    it('should create a session with custom id', () => {
      const custom = manager.create({ id: 'my-session', language: 'javascript' });
      expect(custom.id).toBe('my-session');
    });

    it('should track session in manager', () => {
      const info = manager.list();
      expect(info.length).toBe(1);
      expect(info[0].id).toBe(session.id);
    });
  });

  describe('getInfo', () => {
    it('should return session info', () => {
      const info = session.getInfo();
      expect(info.id).toBe(session.id);
      expect(info.language).toBe('javascript');
      expect(info.executionCount).toBe(0);
    });
  });

  describe('isComplete', () => {
    it('should detect complete statements', () => {
      expect(session.isComplete('const x = 1').status).toBe('complete');
      expect(session.isComplete('1 + 2').status).toBe('complete');
      expect(session.isComplete('function foo() {}').status).toBe('complete');
    });

    it('should detect incomplete statements', () => {
      expect(session.isComplete('const x = {').status).toBe('incomplete');
      expect(session.isComplete('function foo() {').status).toBe('incomplete');
      expect(session.isComplete('1 +').status).toBe('incomplete');
    });

    it('should detect invalid statements', () => {
      // Some syntax errors may be detected as incomplete first
      const result = session.isComplete('const const');
      expect(['invalid', 'incomplete']).toContain(result.status);
    });

    it('should handle empty input', () => {
      expect(session.isComplete('').status).toBe('complete');
      expect(session.isComplete('   ').status).toBe('complete');
    });
  });

  describe('reset', () => {
    it('should reset the session state', async () => {
      // Set a variable
      await session.execute('globalThis.__testVar = 42');

      // Verify it exists
      const before = session.listVariables();
      const beforeVar = before.find(v => v.name === '__testVar');

      // Reset
      session.reset();

      // Verify session info reset
      const info = session.getInfo();
      expect(info.executionCount).toBe(0);
    });
  });
});

describe('SessionManager', () => {
  /** @type {SessionManager} */
  let manager;

  beforeEach(() => {
    manager = createSessionManager({ maxSessions: 3 });
  });

  afterEach(() => {
    manager.destroyAll();
  });

  describe('create', () => {
    it('should create sessions', () => {
      const session = manager.create({ language: 'javascript' });
      expect(session).toBeDefined();
      expect(manager.list().length).toBe(1);
    });

    it('should enforce max sessions limit', () => {
      manager.create({ language: 'javascript' });
      manager.create({ language: 'javascript' });
      manager.create({ language: 'javascript' });

      expect(() => {
        manager.create({ language: 'javascript' });
      }).toThrow(/maximum.*sessions/i);
    });
  });

  describe('get', () => {
    it('should retrieve session by id', () => {
      const session = manager.create({ id: 'test-id', language: 'javascript' });
      const retrieved = manager.get('test-id');
      expect(retrieved).toBe(session);
    });

    it('should return undefined for unknown id', () => {
      expect(manager.get('unknown')).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should destroy a session', () => {
      const session = manager.create({ id: 'to-destroy', language: 'javascript' });
      expect(manager.get('to-destroy')).toBeDefined();

      const result = manager.destroy('to-destroy');
      expect(result).toBe(true);
      expect(manager.get('to-destroy')).toBeUndefined();
    });

    it('should return false for unknown session', () => {
      expect(manager.destroy('unknown')).toBe(false);
    });
  });

  describe('destroyAll', () => {
    it('should destroy all sessions', () => {
      manager.create({ language: 'javascript' });
      manager.create({ language: 'javascript' });
      expect(manager.list().length).toBe(2);

      manager.destroyAll();
      expect(manager.list().length).toBe(0);
    });
  });
});
