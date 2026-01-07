/**
 * mrmd-js
 *
 * Browser-side JavaScript runtime for mrmd notebooks with LSP-like features.
 *
 * Features:
 * - Persistent scope across cell executions
 * - Runtime-powered completions (sees actual values, not just types)
 * - Hover information with live value previews
 * - Variable explorer for inspecting scope
 * - Top-level await support
 *
 * Usage:
 *
 * ```typescript
 * import { JavaScriptClient, JavaScriptExecutor } from 'mrmd-js';
 *
 * // Direct client usage
 * const client = new JavaScriptClient();
 * const result = await client.execute('const x = 1 + 2;');
 * const completions = client.complete('x.toSt', 6);
 * const hover = client.hover('x', 0);
 *
 * // As Executor (compatible with mrmd-editor)
 * const executor = new JavaScriptExecutor();
 * const result = await executor.execute('console.log("Hi")', 'javascript');
 * ```
 *
 * @packageDocumentation
 */

// Main classes
export { JavaScriptClient } from './client';
export { JavaScriptExecutor } from './executor';
export { JavaScriptRuntime, type ArtifactOptions } from './runtime';

// Sandbox (for advanced use)
export { IframeSandbox } from './sandbox';
export {
  transformForPersistence,
  wrapForAsync,
  extractDeclaredVariables,
} from './sandbox/transform';

// LSP features (for custom integrations)
export {
  getCompletions,
  parseCompletionContext,
  type CompletionContext,
} from './lsp/completion';
export {
  getHoverInfo,
  parseIdentifierAtPosition,
  inspectObjectPath,
} from './lsp/hover';
export {
  getVariables,
  getVariableDetail,
  expandVariable,
} from './lsp/variables';

// HTML Rendering (for HTML cells and rich output)
export {
  // Renderer
  HtmlRenderer,
  createHtmlRenderer,
  renderHtml,
  // Script management
  executeScripts,
  clearScripts,
  clearAllScripts,
  hasExecutedScripts,
  // Utilities
  extractScripts,
  extractStyles,
  extractScriptsAndStyles,
  scopeStyles,
  generateScopeClass,
} from './html';

export type {
  RenderMode,
  RenderOptions,
  RenderResult,
  ExtractResult,
} from './html';

// Types
export type {
  // Execution
  ExecutionResult,
  ExecutionError,
  DisplayData,
  StreamCallback,

  // LSP-like
  CompletionResult,
  CompletionItem,
  CompletionType,
  HoverResult,
  VariableInfo,

  // Configuration
  SandboxOptions,
  JavaScriptClientOptions,

  // Interfaces
  Executor,
  SandboxWindow,
  OutputEntry,
} from './types';
