/**
 * HTML Renderer
 *
 * Renders HTML content with three isolation modes:
 *
 * 1. **Direct** - Injects HTML directly into the page DOM
 *    - Styles and scripts affect the entire page
 *    - Fastest, but no isolation
 *    - Use when you trust the content and want page integration
 *
 * 2. **Shadow** - Uses Shadow DOM for complete isolation
 *    - Styles are fully encapsulated (don't leak in or out)
 *    - Scripts run in the shadow context
 *    - Best isolation, but some limitations (e.g., no :host styling from outside)
 *
 * 3. **Scoped** - Uses CSS class prefixing for style isolation
 *    - Styles are scoped via class prefixes (`.scope-123 .card {}`)
 *    - No Shadow DOM overhead
 *    - Good middle ground when you need style isolation but not full encapsulation
 */

import type { RenderOptions, RenderResult } from './types';
import { executeScripts, clearScripts } from './script-manager';
import {
  extractScripts,
  extractScriptsAndStyles,
  scopeStyles,
  generateScopeClass,
  createStyleElement,
  parseHtml,
} from './utils';

/**
 * HTML Renderer class
 *
 * Provides methods for rendering HTML with different isolation strategies.
 */
export class HtmlRenderer {
  /**
   * Render HTML into a container element
   *
   * @param html - HTML content to render
   * @param container - Target container element
   * @param options - Rendering options
   * @returns Render result with details about what was rendered
   */
  render(html: string, container: HTMLElement, options: RenderOptions = {}): RenderResult {
    const {
      mode = 'direct',
      execId = `render-${Date.now()}`,
      executeScripts: shouldExecuteScripts = true,
      onScriptError,
    } = options;

    // Clear previous scripts if re-rendering with same execId
    if (options.execId) {
      clearScripts(execId);
    }

    const result: RenderResult = {
      container,
      scriptsExecuted: 0,
      scriptErrors: [],
    };

    // Handle empty content
    if (!html || !html.trim()) {
      container.textContent = '';
      return result;
    }

    // Route to appropriate rendering method
    switch (mode) {
      case 'shadow':
        return this.renderShadow(html, container, execId, shouldExecuteScripts, onScriptError);

      case 'scoped':
        const scopeClass = options.scopeClass || generateScopeClass(execId);
        return this.renderScoped(html, container, execId, scopeClass, shouldExecuteScripts, onScriptError);

      case 'direct':
      default:
        return this.renderDirect(html, container, execId, shouldExecuteScripts, onScriptError);
    }
  }

  /**
   * Render HTML directly into container (no isolation)
   */
  private renderDirect(
    html: string,
    container: HTMLElement,
    execId: string,
    shouldExecuteScripts: boolean,
    onScriptError?: (error: Error, script: string) => void
  ): RenderResult {
    const result: RenderResult = {
      container,
      scriptsExecuted: 0,
      scriptErrors: [],
    };

    const { html: cleanedHtml, scripts } = extractScripts(html);

    // Clear container and insert HTML
    container.innerHTML = '';
    const fragment = parseHtml(cleanedHtml);
    container.appendChild(fragment);

    // Execute scripts if enabled
    if (shouldExecuteScripts && scripts.length > 0) {
      const errorHandler = (error: Error, script: string) => {
        result.scriptErrors.push(error);
        onScriptError?.(error, script);
      };

      result.scriptsExecuted = executeScripts(execId, scripts, container, errorHandler);
    }

    return result;
  }

  /**
   * Render HTML into Shadow DOM (full isolation)
   */
  private renderShadow(
    html: string,
    container: HTMLElement,
    execId: string,
    shouldExecuteScripts: boolean,
    onScriptError?: (error: Error, script: string) => void
  ): RenderResult {
    // Create or reuse shadow root
    let shadowRoot = container.shadowRoot;
    if (!shadowRoot) {
      shadowRoot = container.attachShadow({ mode: 'open' });
    }

    const result: RenderResult = {
      container,
      shadowRoot,
      scriptsExecuted: 0,
      scriptErrors: [],
    };

    const { html: cleanedHtml, scripts } = extractScripts(html);

    // Clear and set shadow content
    // Note: We use innerHTML here because shadow DOM handles styles correctly
    shadowRoot.innerHTML = cleanedHtml;

    // Execute scripts with shadow root as context
    if (shouldExecuteScripts && scripts.length > 0) {
      const errorHandler = (error: Error, script: string) => {
        result.scriptErrors.push(error);
        onScriptError?.(error, script);
      };

      result.scriptsExecuted = executeScripts(execId, scripts, shadowRoot, errorHandler);
    }

    return result;
  }

  /**
   * Render HTML with scoped CSS (class-based isolation)
   */
  private renderScoped(
    html: string,
    container: HTMLElement,
    execId: string,
    scopeClass: string,
    shouldExecuteScripts: boolean,
    onScriptError?: (error: Error, script: string) => void
  ): RenderResult {
    const result: RenderResult = {
      container,
      scriptsExecuted: 0,
      scriptErrors: [],
    };

    // Add scope class to container
    container.classList.add(scopeClass);

    const { html: cleanedHtml, scripts, styles } = extractScriptsAndStyles(html);

    // Clear container
    container.innerHTML = '';

    // Scope and insert styles
    if (styles.length > 0) {
      const scopedCss = styles
        .map(style => scopeStyles(style, `.${scopeClass}`))
        .join('\n');

      const styleEl = createStyleElement(scopedCss);
      container.appendChild(styleEl);
    }

    // Insert HTML content
    const fragment = parseHtml(cleanedHtml);
    container.appendChild(fragment);

    // Execute scripts
    if (shouldExecuteScripts && scripts.length > 0) {
      const errorHandler = (error: Error, script: string) => {
        result.scriptErrors.push(error);
        onScriptError?.(error, script);
      };

      result.scriptsExecuted = executeScripts(execId, scripts, container, errorHandler);
    }

    return result;
  }

  /**
   * Clear all tracked scripts for an execution ID
   * Call this before re-rendering to allow scripts to run again
   */
  clearScripts(execId: string): void {
    clearScripts(execId);
  }
}

/**
 * Create a new HtmlRenderer instance
 */
export function createHtmlRenderer(): HtmlRenderer {
  return new HtmlRenderer();
}

/**
 * Convenience function to render HTML without creating a renderer instance
 */
export function renderHtml(
  html: string,
  container: HTMLElement,
  options?: RenderOptions
): RenderResult {
  const renderer = new HtmlRenderer();
  return renderer.render(html, container, options);
}
