/**
 * JavaScript Client
 *
 * Main client class providing JavaScript execution with LSP-like features.
 * Combines the sandbox, completion, hover, and variable inspection capabilities.
 *
 * Usage:
 *   const client = new JavaScriptClient();
 *   await client.execute('const x = 1 + 2;');
 *   const completions = client.complete('x.toStr', 7);
 */

import type {
  JavaScriptClientOptions,
  ExecutionResult,
  CompletionResult,
  HoverResult,
  VariableInfo,
  StreamCallback,
  SandboxWindow,
} from './types';
import { IframeSandbox } from './sandbox';
import { getCompletions } from './lsp/completion';
import { getHoverInfo, inspectObjectPath } from './lsp/hover';
import { getVariables, expandVariable } from './lsp/variables';

/**
 * JavaScript runtime client with LSP-like features
 */
export class JavaScriptClient {
  private sandbox: IframeSandbox;
  private initialized = false;

  constructor(options: JavaScriptClientOptions = {}) {
    this.sandbox = new IframeSandbox(options.sandbox);
  }

  /**
   * Ensure the sandbox is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.sandbox.initialize();
      this.initialized = true;
    }
  }

  /**
   * Get the sandbox execution context
   */
  private getContext(): SandboxWindow | null {
    this.ensureInitialized();
    return this.sandbox.getContext();
  }

  // ===========================================================================
  // Execution
  // ===========================================================================

  /**
   * Execute JavaScript code
   *
   * @param code - The code to execute
   * @returns Execution result with output, return value, and timing
   */
  async execute(code: string): Promise<ExecutionResult> {
    this.ensureInitialized();
    return this.sandbox.execute(code);
  }

  /**
   * Execute code with streaming output
   *
   * Streams console output as it happens, useful for long-running code
   * or code that produces incremental output.
   *
   * @param code - The code to execute
   * @param onChunk - Callback for each output chunk
   * @returns Final execution result
   */
  async executeStreaming(
    code: string,
    onChunk: StreamCallback
  ): Promise<ExecutionResult> {
    this.ensureInitialized();

    // For now, we don't have true streaming from the iframe
    // We execute and then stream the result
    // TODO: Implement actual streaming with periodic output polling

    const result = await this.sandbox.execute(code);

    // Stream stdout
    if (result.stdout) {
      const lines = result.stdout.split('\n');
      let accumulated = '';
      for (const line of lines) {
        accumulated += line + '\n';
        onChunk(line + '\n', accumulated, false);
      }
    }

    // Stream stderr
    if (result.stderr) {
      const lines = result.stderr.split('\n');
      let accumulated = result.stdout || '';
      for (const line of lines) {
        accumulated += line + '\n';
        onChunk(line + '\n', accumulated, false);
      }
    }

    // Final chunk with result
    let finalAccumulated = (result.stdout || '') + (result.stderr || '');
    if (result.resultString) {
      const resultLine = `→ ${result.resultString}\n`;
      finalAccumulated += resultLine;
      onChunk(resultLine, finalAccumulated, false);
    }

    // Done
    onChunk('', finalAccumulated, true);

    return result;
  }

  // ===========================================================================
  // LSP-like Features
  // ===========================================================================

  /**
   * Get completions at cursor position
   *
   * @param code - The code being edited
   * @param cursorPos - Cursor position (0-indexed character offset)
   * @returns Completion items with position info
   */
  complete(code: string, cursorPos: number): CompletionResult {
    const ctx = this.getContext();
    const userVars = this.sandbox.getVariables();
    return getCompletions(code, cursorPos, ctx, userVars);
  }

  /**
   * Get hover information at cursor position
   *
   * @param code - The code being edited
   * @param cursorPos - Cursor position
   * @returns Hover info with type, value preview, and signature
   */
  hover(code: string, cursorPos: number): HoverResult {
    const ctx = this.getContext();
    return getHoverInfo(code, cursorPos, ctx);
  }

  /**
   * Inspect an object by path
   *
   * @param path - Object path (e.g., "obj.prop" or "arr[0]")
   * @returns Object properties with type and value info
   */
  inspect(path: string): Record<string, unknown> | null {
    const ctx = this.getContext();
    return inspectObjectPath(path, ctx);
  }

  /**
   * Get all variables in scope
   *
   * @returns Array of variable information
   */
  variables(): VariableInfo[] {
    this.ensureInitialized();
    const userVars = this.sandbox.getVariables();
    return getVariables(userVars);
  }

  /**
   * Expand a variable to see its children
   *
   * @param path - Variable path to expand
   * @returns Array of child variable info, or null if not expandable
   */
  expandVariable(path: string): VariableInfo[] | null {
    const ctx = this.getContext();
    return expandVariable(path, ctx);
  }

  // ===========================================================================
  // Scope Management
  // ===========================================================================

  /**
   * Get all user-defined variables and their values
   *
   * @returns Object mapping variable names to values
   */
  getScope(): Record<string, unknown> {
    this.ensureInitialized();
    return this.sandbox.getVariables();
  }

  /**
   * Get a specific variable's value
   *
   * @param name - Variable name
   * @returns Variable value, or undefined if not found
   */
  getVariable(name: string): unknown {
    this.ensureInitialized();
    return this.sandbox.getVariable(name);
  }

  /**
   * Check if a variable exists in scope
   *
   * @param name - Variable name
   * @returns Whether the variable exists
   */
  hasVariable(name: string): boolean {
    this.ensureInitialized();
    return this.sandbox.hasVariable(name);
  }

  /**
   * Check if this client is using the main window context
   */
  isMainContext(): boolean {
    return this.sandbox.isMainContext();
  }

  /**
   * Get the iframe element (null if using main context)
   */
  getIframe(): HTMLIFrameElement | null {
    return this.sandbox.getIframe();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Reset the runtime (clear all variables)
   */
  reset(): void {
    if (this.initialized) {
      this.sandbox.reset();
    }
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void {
    if (this.initialized) {
      this.sandbox.destroy();
      this.initialized = false;
    }
  }
}
