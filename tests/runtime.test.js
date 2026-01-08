/**
 * MrpRuntime Tests
 *
 * Tests for the main runtime class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MrpRuntime, createRuntime } from '../src/runtime.js';

describe('MrpRuntime', () => {
  /** @type {MrpRuntime} */
  let runtime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  afterEach(() => {
    runtime.destroy();
  });

  describe('getCapabilities', () => {
    it('should return runtime capabilities', () => {
      const caps = runtime.getCapabilities();

      expect(caps.runtime).toBe('mrmd-js');
      expect(caps.version).toBeDefined();
      expect(caps.languages).toContain('javascript');
      expect(caps.features.execute).toBe(true);
      expect(caps.maxSessions).toBeGreaterThan(0);
    });
  });

  describe('session management', () => {
    it('should create sessions', () => {
      const session = runtime.createSession({ language: 'javascript' });
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
    });

    it('should list sessions', () => {
      runtime.createSession({ language: 'javascript' });
      runtime.createSession({ language: 'javascript' });

      const sessions = runtime.listSessions();
      expect(sessions.length).toBe(2);
    });

    it('should get session by id', () => {
      const session = runtime.createSession({ id: 'test-session', language: 'javascript' });
      const retrieved = runtime.getSession('test-session');
      expect(retrieved).toBe(session);
    });

    it('should get or create session', () => {
      const session1 = runtime.getOrCreateSession('my-session', { language: 'javascript' });
      const session2 = runtime.getOrCreateSession('my-session', { language: 'javascript' });
      expect(session1).toBe(session2);
    });

    it('should destroy session', () => {
      runtime.createSession({ id: 'to-destroy', language: 'javascript' });
      expect(runtime.getSession('to-destroy')).toBeDefined();

      runtime.destroySession('to-destroy');
      expect(runtime.getSession('to-destroy')).toBeUndefined();
    });

    it('should reset session', () => {
      const session = runtime.createSession({ id: 'to-reset', language: 'javascript' });
      const result = runtime.resetSession('to-reset');
      expect(result).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('should check code completeness', () => {
      expect(runtime.isComplete('const x = 1').status).toBe('complete');
      expect(runtime.isComplete('const x = {').status).toBe('incomplete');
    });
  });

  describe('format', () => {
    it('should format code', async () => {
      const result = await runtime.format('const x=1');
      expect(result.formatted).toBeDefined();
    });
  });

  describe('completions', () => {
    it.skip('should get completions (requires browser environment)', () => {
      // This test requires a browser environment with document defined
      // The session needs to be created first which may require iframe
      const result = runtime.complete('con', 3);
      expect(result.items).toBeDefined();
    });
  });

  describe('extensibility', () => {
    it('should provide executor registry', () => {
      const registry = runtime.getExecutorRegistry();
      expect(registry).toBeDefined();
      expect(registry.languages()).toContain('javascript');
    });

    it('should provide session manager', () => {
      const manager = runtime.getSessionManager();
      expect(manager).toBeDefined();
    });
  });
});

describe('createRuntime', () => {
  it('should create runtime with default options', () => {
    const runtime = createRuntime();
    expect(runtime).toBeInstanceOf(MrpRuntime);
    runtime.destroy();
  });

  it('should create runtime with custom options', () => {
    const runtime = createRuntime({
      maxSessions: 5,
      defaultIsolation: 'main',
    });

    const caps = runtime.getCapabilities();
    expect(caps.maxSessions).toBe(5);

    runtime.destroy();
  });
});
