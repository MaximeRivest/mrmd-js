/**
 * HTML Rendering Module
 *
 * Provides utilities for rendering HTML content with multiple isolation strategies:
 * - Direct rendering (no isolation)
 * - Shadow DOM (full isolation)
 * - Scoped CSS (class-based isolation)
 *
 * Also includes script management to prevent re-execution when widgets are recreated.
 */

// Main renderer
export { HtmlRenderer, createHtmlRenderer, renderHtml } from './renderer';

// Script management
export {
  executeScripts,
  clearScripts,
  clearAllScripts,
  hasExecutedScripts,
  getExecutedCount,
  hasExecutedScript,
  hashContent,
} from './script-manager';

// HTML utilities
export {
  extractScripts,
  extractStyles,
  extractScriptsAndStyles,
  scopeStyles,
  generateScopeClass,
  createStyleElement,
  parseHtml,
} from './utils';

// Types
export type {
  RenderMode,
  RenderOptions,
  ExtractResult,
  RenderResult,
} from './types';
