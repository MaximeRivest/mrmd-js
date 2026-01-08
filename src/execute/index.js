/**
 * Execute Module
 *
 * Provides executors for different languages and the registry to manage them.
 *
 * @module execute
 */

// Interface
export { BaseExecutor } from './interface.js';

// Registry
export { ExecutorRegistry, createExecutorRegistry } from './registry.js';

// Executors
export { JavaScriptExecutor, createJavaScriptExecutor } from './javascript.js';
export { HtmlExecutor, createHtmlExecutor, extractScripts, extractStyles } from './html.js';
export {
  CssExecutor,
  createCssExecutor,
  scopeStyles,
  generateScopeClass,
} from './css.js';

// Import for factory function
import { ExecutorRegistry } from './registry.js';
import { JavaScriptExecutor } from './javascript.js';
import { HtmlExecutor } from './html.js';
import { CssExecutor } from './css.js';

/**
 * Create a registry with default executors registered
 * @returns {ExecutorRegistry}
 */
export function createDefaultExecutorRegistry() {
  const registry = new ExecutorRegistry();
  registry.register(new JavaScriptExecutor());
  registry.register(new HtmlExecutor());
  registry.register(new CssExecutor());
  return registry;
}
