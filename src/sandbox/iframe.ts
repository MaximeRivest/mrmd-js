/**
 * Iframe Sandbox
 *
 * Provides an isolated JavaScript execution environment using a hidden iframe.
 * Variables persist in the iframe's global scope between executions.
 *
 * Features:
 * - Isolated global scope (doesn't pollute main page)
 * - Full browser environment (fetch, DOM APIs, etc.)
 * - Console interception for output capture
 * - Reset capability by destroying and recreating iframe
 */

import type {
  SandboxOptions,
  SandboxWindow,
  ExecutionResult,
  ExecutionError,
} from '../types';
import {
  transformForPersistence,
  wrapForAsync,
  extractDeclaredVariables,
} from './transform';

/**
 * Iframe-based JavaScript sandbox
 *
 * Supports three modes:
 * 1. Isolated (default) - Hidden iframe, fully isolated
 * 2. Main context - Execute in main window (access page's state)
 * 3. Visible artifact - Iframe rendered into a target element
 */
export class IframeSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private ctx: SandboxWindow | null = null;
  private options: SandboxOptions;
  private useMainContext: boolean;
  private originalConsole: Partial<Console> | null = null;

  constructor(options: SandboxOptions = {}) {
    this.options = options;
    this.useMainContext = options.useMainContext ?? false;
  }

  /**
   * Check if using main window context
   */
  isMainContext(): boolean {
    return this.useMainContext;
  }

  /**
   * Get the iframe element (null if using main context)
   */
  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }

  /**
   * Initialize the sandbox (create iframe and set up environment)
   */
  initialize(): void {
    if (this.useMainContext) {
      this.initializeMainContext();
    } else {
      this.initializeIframe();
    }
  }

  /**
   * Initialize using the main window context
   */
  private initializeMainContext(): void {
    // Use the main window as context
    this.ctx = window as unknown as SandboxWindow;

    // Initialize output queues on main window (prefixed to avoid conflicts)
    if (!this.ctx.__outputQueue__) {
      this.ctx.__outputQueue__ = [];
    }
    if (!this.ctx.__displayQueue__) {
      this.ctx.__displayQueue__ = [];
    }
    if (!this.ctx.__userVars__) {
      this.ctx.__userVars__ = new Set();
    }

    // Set up utilities (but don't add mainDocument/mainWindow - we ARE main)
    this.setupUtilities();

    // Set up console interception (careful - this affects the real console)
    this.setupConsoleInterception();
  }

  /**
   * Initialize using an iframe
   */
  private initializeIframe(): void {
    if (this.iframe) {
      this.destroy();
    }

    // Create iframe
    this.iframe = document.createElement('iframe');
    this.iframe.sandbox.add('allow-scripts');
    this.iframe.sandbox.add('allow-same-origin');

    // Handle visible vs hidden iframe
    if (this.options.targetElement) {
      // Visible artifact mode - render into target element
      const styles = this.options.iframeStyles || {};
      this.iframe.style.width = styles.width || '100%';
      this.iframe.style.height = styles.height || '100%';
      this.iframe.style.border = styles.border || 'none';
      this.iframe.style.display = 'block';

      // Apply any additional styles
      for (const [key, value] of Object.entries(styles)) {
        if (value && typeof value === 'string') {
          this.iframe.style.setProperty(key, value);
        }
      }

      this.options.targetElement.appendChild(this.iframe);
    } else {
      // Hidden mode
      this.iframe.style.display = 'none';
      document.body.appendChild(this.iframe);
    }

    // Get the iframe's window
    this.ctx = this.iframe.contentWindow as SandboxWindow;

    // Initialize output queues
    this.ctx.__outputQueue__ = [];
    this.ctx.__displayQueue__ = [];
    this.ctx.__userVars__ = new Set();

    // Set up utilities
    this.setupUtilities();

    // Set up console interception
    this.setupConsoleInterception();

    // For visible iframes, set up a basic HTML structure
    if (this.options.targetElement && this.iframe.contentDocument) {
      this.iframe.contentDocument.body.style.margin = '0';
      this.iframe.contentDocument.body.style.padding = '0';
      this.iframe.contentDocument.body.style.fontFamily = 'system-ui, sans-serif';
    }
  }

  /**
   * Set up utility functions in the sandbox
   */
  private setupUtilities(): void {
    if (!this.ctx) return;

    // Access to main document (if allowed and not already main context)
    if (this.options.allowMainDocumentAccess !== false && !this.useMainContext) {
      this.ctx.mainDocument = document;
      this.ctx.mainWindow = window;
    }

    // Sleep helper for async operations
    this.ctx.sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Print helper (alias for console.log)
    this.ctx.print = (...args: unknown[]) => {
      this.ctx?.console.log(...args);
    };

    // Display helper for rich output
    this.ctx.display = (data: unknown, mimeType = 'text/plain') => {
      let content: string;
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
      this.ctx?.__displayQueue__.push({ mimeType, data: content });
    };

    // Inject custom utilities
    if (this.options.utilities) {
      for (const [key, value] of Object.entries(this.options.utilities)) {
        (this.ctx as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  /**
   * Set up console interception to capture output
   */
  private setupConsoleInterception(): void {
    if (!this.ctx) return;

    const originalLog = this.ctx.console.log.bind(this.ctx.console);
    const originalError = this.ctx.console.error.bind(this.ctx.console);
    const originalWarn = this.ctx.console.warn.bind(this.ctx.console);
    const originalInfo = this.ctx.console.info.bind(this.ctx.console);

    // Save originals for restoration (important for main context)
    this.originalConsole = {
      log: originalLog,
      error: originalError,
      warn: originalWarn,
      info: originalInfo,
    };

    const formatArgs = (args: unknown[]): string => {
      return args
        .map((arg) => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
    };

    this.ctx.console.log = (...args: unknown[]) => {
      this.ctx?.__outputQueue__.push({
        type: 'log',
        content: formatArgs(args),
        timestamp: Date.now(),
      });
      this.options.onConsoleLog?.(...args);
      originalLog(...args);
    };

    this.ctx.console.error = (...args: unknown[]) => {
      this.ctx?.__outputQueue__.push({
        type: 'error',
        content: formatArgs(args),
        timestamp: Date.now(),
      });
      this.options.onConsoleError?.(...args);
      originalError(...args);
    };

    this.ctx.console.warn = (...args: unknown[]) => {
      this.ctx?.__outputQueue__.push({
        type: 'warn',
        content: formatArgs(args),
        timestamp: Date.now(),
      });
      this.options.onConsoleWarn?.(...args);
      originalWarn(...args);
    };

    this.ctx.console.info = (...args: unknown[]) => {
      this.ctx?.__outputQueue__.push({
        type: 'info',
        content: formatArgs(args),
        timestamp: Date.now(),
      });
      originalInfo(...args);
    };
  }

  /**
   * Restore original console methods (for main context cleanup)
   */
  private restoreConsole(): void {
    if (!this.ctx || !this.originalConsole) return;

    if (this.originalConsole.log) {
      this.ctx.console.log = this.originalConsole.log as typeof console.log;
    }
    if (this.originalConsole.error) {
      this.ctx.console.error = this.originalConsole.error as typeof console.error;
    }
    if (this.originalConsole.warn) {
      this.ctx.console.warn = this.originalConsole.warn as typeof console.warn;
    }
    if (this.originalConsole.info) {
      this.ctx.console.info = this.originalConsole.info as typeof console.info;
    }

    this.originalConsole = null;
  }

  /**
   * Execute code in the sandbox
   */
  async execute(code: string): Promise<ExecutionResult> {
    if (!this.ctx) {
      this.initialize();
    }

    // Clear output queues
    this.ctx!.__outputQueue__ = [];
    this.ctx!.__displayQueue__ = [];

    // Track variables that will be declared
    const declaredVars = extractDeclaredVariables(code);
    for (const v of declaredVars) {
      this.ctx!.__userVars__.add(v);
    }

    // Transform code for persistence and async support
    const transformedCode = transformForPersistence(code);
    const wrappedCode = wrapForAsync(transformedCode);

    const startTime = performance.now();

    try {
      // Execute in iframe context
      const result = await this.ctx!.eval(wrappedCode);
      const duration = performance.now() - startTime;

      // Collect outputs
      const outputs = this.ctx!.__outputQueue__;
      const stdout = outputs
        .filter((o) => o.type === 'log' || o.type === 'info')
        .map((o) => o.content)
        .join('\n');
      const stderr = outputs
        .filter((o) => o.type === 'error' || o.type === 'warn')
        .map((o) => (o.type === 'error' ? `Error: ${o.content}` : `Warning: ${o.content}`))
        .join('\n');

      return {
        success: true,
        stdout,
        stderr,
        result,
        resultString: this.formatResult(result),
        duration,
        displayData: [...this.ctx!.__displayQueue__],
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const execError = this.formatError(error);

      // Collect any output that happened before error
      const outputs = this.ctx!.__outputQueue__;
      const stdout = outputs
        .filter((o) => o.type === 'log' || o.type === 'info')
        .map((o) => o.content)
        .join('\n');

      return {
        success: false,
        stdout,
        stderr: `${execError.name}: ${execError.message}`,
        error: execError,
        duration,
        displayData: [],
      };
    }
  }

  /**
   * Format the return value for display
   */
  private formatResult(result: unknown): string | undefined {
    if (result === undefined) {
      return undefined;
    }

    if (result === null) {
      return 'null';
    }

    if (typeof result === 'function') {
      return `[Function: ${result.name || 'anonymous'}]`;
    }

    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }

    return String(result);
  }

  /**
   * Format an error for the result
   */
  private formatError(error: unknown): ExecutionError {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n'),
      };
    }
    return {
      name: 'Error',
      message: String(error),
    };
  }

  /**
   * Get all user-defined variables in the sandbox
   */
  getVariables(): Record<string, unknown> {
    if (!this.ctx) return {};

    const vars: Record<string, unknown> = {};

    // Only return variables we explicitly tracked as user-defined
    for (const key of this.ctx.__userVars__) {
      try {
        const value = (this.ctx as unknown as Record<string, unknown>)[key];
        vars[key] = value;
      } catch {
        // Skip inaccessible properties
      }
    }

    return vars;
  }

  /**
   * Get a specific variable's value
   */
  getVariable(name: string): unknown {
    if (!this.ctx) return undefined;
    return (this.ctx as unknown as Record<string, unknown>)[name];
  }

  /**
   * Check if a variable exists in the sandbox
   */
  hasVariable(name: string): boolean {
    if (!this.ctx) return false;
    return name in this.ctx;
  }

  /**
   * Get the execution context (for advanced use)
   */
  getContext(): SandboxWindow | null {
    return this.ctx;
  }

  /**
   * Reset the sandbox (clear all variables)
   */
  reset(): void {
    if (this.useMainContext) {
      // For main context, we can't recreate - just clear tracked variables
      if (this.ctx) {
        // Delete user-defined variables from window
        for (const key of this.ctx.__userVars__) {
          try {
            delete (this.ctx as unknown as Record<string, unknown>)[key];
          } catch {
            // Some properties can't be deleted
          }
        }
        this.ctx.__userVars__.clear();
        this.ctx.__outputQueue__ = [];
        this.ctx.__displayQueue__ = [];
      }
    } else {
      this.destroy();
      this.initialize();
    }
  }

  /**
   * Destroy the sandbox (remove iframe)
   */
  destroy(): void {
    // Restore console if we intercepted it
    this.restoreConsole();

    if (this.useMainContext) {
      // For main context, clean up our additions
      if (this.ctx) {
        // Clear user variables
        for (const key of this.ctx.__userVars__ || []) {
          try {
            delete (this.ctx as unknown as Record<string, unknown>)[key];
          } catch {
            // Some properties can't be deleted
          }
        }
        // Remove our internal properties
        delete (this.ctx as unknown as Record<string, unknown>).__outputQueue__;
        delete (this.ctx as unknown as Record<string, unknown>).__displayQueue__;
        delete (this.ctx as unknown as Record<string, unknown>).__userVars__;
        delete (this.ctx as unknown as Record<string, unknown>).sleep;
        delete (this.ctx as unknown as Record<string, unknown>).display;
        delete (this.ctx as unknown as Record<string, unknown>).print;
      }
      this.ctx = null;
    } else if (this.iframe) {
      // For iframe, remove from DOM
      const parent = this.iframe.parentElement;
      if (parent) {
        parent.removeChild(this.iframe);
      }
      this.iframe = null;
      this.ctx = null;
    }
  }
}
