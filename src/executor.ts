/**
 * JavaScript Executor
 *
 * Implements the Executor interface from mrmd-editor.
 * Wraps JavaScriptClient to provide a compatible interface.
 *
 * Usage in mrmd-editor:
 *   import { JavaScriptExecutor } from 'mrmd-js';
 *   const executor = new JavaScriptExecutor();
 *   const result = await executor.execute('console.log("Hello")', 'javascript');
 */

import type {
  Executor,
  ExecutionResult,
  StreamCallback,
  JavaScriptClientOptions,
} from './types';
import { JavaScriptClient } from './client';

/**
 * Supported language identifiers
 */
const SUPPORTED_LANGUAGES = ['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx'];

/**
 * JavaScript executor implementing the mrmd-editor Executor interface
 */
export class JavaScriptExecutor implements Executor {
  private client: JavaScriptClient;

  /**
   * Create a new JavaScript executor
   *
   * @param options - Client options
   */
  constructor(options: JavaScriptClientOptions = {}) {
    this.client = new JavaScriptClient(options);
  }

  /**
   * Get the underlying client for direct access to LSP features
   */
  getClient(): JavaScriptClient {
    return this.client;
  }

  /**
   * Execute code and return result
   *
   * @param code - The code to execute
   * @param language - Language identifier (must be javascript/js/jsx)
   * @param execId - Optional execution ID for tracking
   * @returns Execution result
   */
  async execute(
    code: string,
    language: string,
    _execId?: string
  ): Promise<ExecutionResult> {
    if (!this.supports(language)) {
      return {
        success: false,
        stdout: '',
        stderr: `Language '${language}' is not supported by JavaScriptExecutor`,
        error: {
          name: 'UnsupportedLanguageError',
          message: `Expected one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
        },
      };
    }

    return this.client.execute(code);
  }

  /**
   * Execute code with streaming output
   *
   * @param code - The code to execute
   * @param language - Language identifier
   * @param onChunk - Callback for each output chunk
   * @param execId - Optional execution ID
   * @returns Final execution result
   */
  async executeStreaming(
    code: string,
    language: string,
    onChunk: StreamCallback,
    _execId?: string
  ): Promise<ExecutionResult> {
    if (!this.supports(language)) {
      const error = `Language '${language}' is not supported by JavaScriptExecutor`;
      onChunk(error, error, true);
      return {
        success: false,
        stdout: '',
        stderr: error,
        error: {
          name: 'UnsupportedLanguageError',
          message: `Expected one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
        },
      };
    }

    return this.client.executeStreaming(code, onChunk);
  }

  /**
   * Check if executor supports a language
   *
   * @param language - Language identifier to check
   * @returns Whether the language is supported
   */
  supports(language: string): boolean {
    return SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * Clean up assets for a given execution ID
   *
   * JavaScript runtime doesn't create file assets, so this is a no-op.
   *
   * @param execId - Execution ID
   */
  async cleanupAssets(_execId: string): Promise<void> {
    // No-op for JavaScript - we don't create file assets
  }

  /**
   * Reset the runtime (clear all variables)
   */
  reset(): void {
    this.client.reset();
  }

  /**
   * Destroy the executor and clean up resources
   */
  destroy(): void {
    this.client.destroy();
  }
}
