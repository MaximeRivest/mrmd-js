/**
 * mrmd-js
 *
 * MRP-compliant browser JavaScript runtime.
 *
 * @example
 * import { MrpRuntime } from 'mrmd-js';
 *
 * const runtime = new MrpRuntime();
 * const session = runtime.createSession({ language: 'javascript' });
 * const result = await session.execute('const x = 1 + 2; x');
 *
 * @module mrmd-js
 */

// Types (JSDoc only, re-exported for documentation)
export * from './types/index.js';

// Constants
export * from './constants.js';

// Session Management (Phase 2)
export {
  Session,
  createSession,
  SessionManager,
  createSessionManager,
} from './session/index.js';

// Context Infrastructure (Phase 1)
export {
  ConsoleCapture,
  createConsoleCapture,
  IframeContext,
  createIframeContext,
  MainContext,
  createMainContext,
} from './session/index.js';

// Transforms
export {
  transformForPersistence,
  wrapForAsync,
  wrapWithLastExpression,
  extractDeclaredVariables,
} from './transform/index.js';

// Executors (Phase 3)
export {
  // Base
  BaseExecutor,
  // Registry
  ExecutorRegistry,
  createExecutorRegistry,
  createDefaultExecutorRegistry,
  // JavaScript
  JavaScriptExecutor,
  createJavaScriptExecutor,
  // HTML
  HtmlExecutor,
  createHtmlExecutor,
  extractScripts,
  extractStyles,
  // CSS
  CssExecutor,
  createCssExecutor,
  scopeStyles,
  generateScopeClass,
} from './execute/index.js';

// LSP Features (Phase 4)
export {
  // Parsing utilities
  parseIdentifierAtPosition,
  parseCompletionContext,
  getStringOrCommentContext,
  getWordAtCursor,
  splitObjectPath,
  isIdentifierStart,
  isIdentifierPart,
  isKeyword,
  getKeywords,
  getCommonGlobals,
  // Formatting utilities
  formatValue,
  formatValueShort,
  getTypeName,
  getCompletionKind,
  isExpandable,
  getFunctionSignature,
  getFunctionSource,
  getSizeDescription,
  // Completions
  getCompletions,
  // Hover
  getHoverInfo,
  // Inspection
  getInspectInfo,
  inspectPath,
  // Variables
  listVariables,
  getVariableDetail,
  expandVariable,
  formatVariableInfo,
  getChildren,
  getMethods,
  getAttributes,
} from './lsp/index.js';

// Analysis Features (Phase 5)
export {
  isComplete,
  getSuggestedIndent,
  formatCode,
  basicFormat,
  formatHtml,
  formatCss,
  setPrettier,
  hasPrettier,
} from './analysis/index.js';

// MRP Runtime (Phase 6)
export { MrpRuntime, createRuntime } from './runtime.js';

// Client Utilities (Phase 7)
export {
  HtmlRenderer,
  createHtmlRenderer,
  scopeStyles as scopeStylesUtil,
  CssApplicator,
  createCssApplicator,
  AnsiRenderer,
  ansiToHtml,
  stripAnsi,
  createAnsiRenderer,
} from './utils/index.js';
