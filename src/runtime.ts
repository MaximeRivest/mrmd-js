/**
 * JavaScript Runtime
 *
 * Multi-scope runtime manager that allows creating multiple isolated
 * execution contexts (scopes). Each scope is a separate JavaScriptClient
 * with its own variables and state.
 *
 * Use cases:
 * - Multiple notebooks/documents open simultaneously
 * - Separate scopes for different visualizations/artifacts
 * - Main page context access alongside isolated execution
 *
 * Usage:
 *   const runtime = new JavaScriptRuntime();
 *
 *   // Default scope (isolated iframe)
 *   await runtime.execute('const x = 1');
 *
 *   // Named scopes (each isolated)
 *   const chart1 = runtime.scope('chart-1');
 *   const chart2 = runtime.scope('chart-2');
 *   await chart1.execute('const data = [1,2,3]');
 *   await chart2.execute('const data = [4,5,6]');
 *
 *   // Main page context
 *   await runtime.executeInMain('document.title');
 *
 *   // Visible artifact
 *   const viz = runtime.createArtifact('viz', document.getElementById('container'));
 *   await viz.execute('document.body.innerHTML = "<h1>Hello</h1>"');
 */

import type {
  ExecutionResult,
  CompletionResult,
  HoverResult,
  VariableInfo,
  StreamCallback,
  SandboxOptions,
} from './types';
import { JavaScriptClient } from './client';

/**
 * Options for creating an artifact scope
 */
export interface ArtifactOptions {
  /** CSS styles for the artifact iframe */
  styles?: Partial<CSSStyleDeclaration>;
  /** Additional sandbox options */
  sandbox?: Omit<SandboxOptions, 'targetElement' | 'iframeStyles'>;
}

/**
 * Multi-scope JavaScript runtime manager
 */
export class JavaScriptRuntime {
  /** Named scopes (isolated iframes) */
  private scopes = new Map<string, JavaScriptClient>();

  /** Default scope */
  private defaultScope: JavaScriptClient | null = null;

  /** Main context client (for executeInMain) */
  private mainClient: JavaScriptClient | null = null;

  /** Default sandbox options for new scopes */
  private defaultOptions: SandboxOptions;

  constructor(options: SandboxOptions = {}) {
    this.defaultOptions = options;
  }

  // ===========================================================================
  // Default Scope (convenience methods)
  // ===========================================================================

  /**
   * Get or create the default scope
   */
  private getDefaultScope(): JavaScriptClient {
    if (!this.defaultScope) {
      this.defaultScope = new JavaScriptClient({ sandbox: this.defaultOptions });
    }
    return this.defaultScope;
  }

  /**
   * Execute code in the default scope
   */
  async execute(code: string): Promise<ExecutionResult> {
    return this.getDefaultScope().execute(code);
  }

  /**
   * Execute with streaming in the default scope
   */
  async executeStreaming(
    code: string,
    onChunk: StreamCallback
  ): Promise<ExecutionResult> {
    return this.getDefaultScope().executeStreaming(code, onChunk);
  }

  /**
   * Get completions in the default scope
   */
  complete(code: string, cursorPos: number): CompletionResult {
    return this.getDefaultScope().complete(code, cursorPos);
  }

  /**
   * Get hover info in the default scope
   */
  hover(code: string, cursorPos: number): HoverResult {
    return this.getDefaultScope().hover(code, cursorPos);
  }

  /**
   * Get variables in the default scope
   */
  variables(): VariableInfo[] {
    return this.getDefaultScope().variables();
  }

  /**
   * Reset the default scope
   */
  reset(): void {
    if (this.defaultScope) {
      this.defaultScope.reset();
    }
  }

  /**
   * Get completions for a specific scope
   */
  completeInScope(scopeName: string, code: string, cursorPos: number): CompletionResult {
    const client = this.scopes.get(scopeName);
    if (!client) {
      return { items: [], from: cursorPos, to: cursorPos };
    }
    return client.complete(code, cursorPos);
  }

  /**
   * Get hover info for a specific scope
   */
  hoverInScope(scopeName: string, code: string, cursorPos: number): HoverResult {
    const client = this.scopes.get(scopeName);
    if (!client) {
      return { found: false, name: '', type: '' };
    }
    return client.hover(code, cursorPos);
  }

  /**
   * Get variables from a specific scope
   */
  variablesInScope(scopeName: string): VariableInfo[] {
    const client = this.scopes.get(scopeName);
    if (!client) {
      return [];
    }
    return client.variables();
  }

  /**
   * Get variables from ALL scopes (for cross-scope awareness)
   * Returns a map of scope name -> variables
   */
  allVariables(): Map<string, VariableInfo[]> {
    const result = new Map<string, VariableInfo[]>();

    // Default scope
    if (this.defaultScope) {
      result.set('default', this.defaultScope.variables());
    }

    // Named scopes
    for (const [name, client] of this.scopes) {
      result.set(name, client.variables());
    }

    // Main context (if initialized)
    if (this.mainClient) {
      result.set('main', this.mainClient.variables());
    }

    return result;
  }

  // ===========================================================================
  // Named Scopes
  // ===========================================================================

  /**
   * Get or create a named scope
   *
   * Each scope is an isolated execution environment with its own variables.
   *
   * @param name - Unique name for the scope
   * @param options - Optional sandbox options for this scope
   * @returns JavaScriptClient for the scope
   */
  scope(name: string, options?: SandboxOptions): JavaScriptClient {
    let client = this.scopes.get(name);

    if (!client) {
      client = new JavaScriptClient({
        sandbox: { ...this.defaultOptions, ...options },
      });
      this.scopes.set(name, client);
    }

    return client;
  }

  /**
   * Check if a named scope exists
   */
  hasScope(name: string): boolean {
    return this.scopes.has(name);
  }

  /**
   * List all named scopes
   */
  listScopes(): string[] {
    return Array.from(this.scopes.keys());
  }

  /**
   * Destroy a named scope
   */
  destroyScope(name: string): boolean {
    const client = this.scopes.get(name);
    if (client) {
      client.destroy();
      this.scopes.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Reset a named scope (clear variables but keep the scope)
   */
  resetScope(name: string): boolean {
    const client = this.scopes.get(name);
    if (client) {
      client.reset();
      return true;
    }
    return false;
  }

  // ===========================================================================
  // Main Context
  // ===========================================================================

  /**
   * Execute code in the main window context
   *
   * WARNING: This gives access to the page's variables and DOM.
   * Changes can affect the page's state.
   *
   * @param code - Code to execute
   * @returns Execution result
   */
  async executeInMain(code: string): Promise<ExecutionResult> {
    if (!this.mainClient) {
      this.mainClient = new JavaScriptClient({
        sandbox: {
          ...this.defaultOptions,
          useMainContext: true,
        },
      });
    }
    return this.mainClient.execute(code);
  }

  /**
   * Get the main context client (creates if needed)
   *
   * Use this for completions/hover in main context.
   */
  getMainClient(): JavaScriptClient {
    if (!this.mainClient) {
      this.mainClient = new JavaScriptClient({
        sandbox: {
          ...this.defaultOptions,
          useMainContext: true,
        },
      });
    }
    return this.mainClient;
  }

  // ===========================================================================
  // Artifacts (Visible Iframes)
  // ===========================================================================

  /**
   * Create a visible artifact scope
   *
   * The artifact is rendered into the target element as a visible iframe.
   * Code can render to the iframe's document.
   *
   * @param name - Unique name for the artifact
   * @param targetElement - DOM element to render the artifact into
   * @param options - Optional artifact options
   * @returns JavaScriptClient for the artifact
   */
  createArtifact(
    name: string,
    targetElement: HTMLElement,
    options: ArtifactOptions = {}
  ): JavaScriptClient {
    // Destroy existing artifact with same name
    this.destroyScope(name);

    const client = new JavaScriptClient({
      sandbox: {
        ...this.defaultOptions,
        ...options.sandbox,
        targetElement,
        iframeStyles: options.styles,
      },
    });

    this.scopes.set(name, client);
    return client;
  }

  /**
   * Get an existing artifact by name
   */
  getArtifact(name: string): JavaScriptClient | undefined {
    return this.scopes.get(name);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Destroy all scopes and clean up
   */
  destroy(): void {
    // Destroy default scope
    if (this.defaultScope) {
      this.defaultScope.destroy();
      this.defaultScope = null;
    }

    // Destroy main client
    if (this.mainClient) {
      this.mainClient.destroy();
      this.mainClient = null;
    }

    // Destroy all named scopes
    for (const client of this.scopes.values()) {
      client.destroy();
    }
    this.scopes.clear();
  }

  /**
   * Reset all scopes (clear variables but keep scopes)
   */
  resetAll(): void {
    if (this.defaultScope) {
      this.defaultScope.reset();
    }

    if (this.mainClient) {
      this.mainClient.reset();
    }

    for (const client of this.scopes.values()) {
      client.reset();
    }
  }
}
