/**
 * HTML Renderer
 *
 * Utility for rendering HTML displayData from cell execution.
 * Provides three rendering modes: direct, shadow, and scoped.
 *
 * @module utils/html-renderer
 */

/**
 * @typedef {'direct' | 'shadow' | 'scoped'} RenderMode
 */

/**
 * @typedef {Object} RenderOptions
 * @property {RenderMode} [mode='direct'] - Rendering mode
 * @property {string} [scopeClass] - Scope class for 'scoped' mode
 * @property {boolean} [executeScripts=true] - Execute inline scripts
 * @property {(error: Error, script: string) => void} [onScriptError] - Script error callback
 * @property {boolean} [clear=true] - Clear container before rendering
 */

/**
 * @typedef {Object} RenderResult
 * @property {HTMLElement} container - Container element
 * @property {ShadowRoot} [shadowRoot] - Shadow root if shadow mode
 * @property {number} scriptsExecuted - Number of scripts executed
 * @property {Error[]} scriptErrors - Script errors
 */

/** @type {Set<string>} */
const executedScripts = new Set();

/**
 * HTML Renderer class for rendering displayData
 */
export class HtmlRenderer {
  /** @type {Map<string, Set<string>>} */
  #scriptHashes = new Map();

  /**
   * Render HTML string into a container
   *
   * @param {string} html - HTML string to render
   * @param {HTMLElement} container - Target container
   * @param {RenderOptions} [options]
   * @returns {RenderResult}
   */
  render(html, container, options = {}) {
    const mode = options.mode ?? 'direct';

    switch (mode) {
      case 'shadow':
        return this.#renderShadow(html, container, options);
      case 'scoped':
        return this.#renderScoped(html, container, options);
      case 'direct':
      default:
        return this.#renderDirect(html, container, options);
    }
  }

  /**
   * Render displayData into container
   *
   * @param {import('../types/execution.js').DisplayData} displayData
   * @param {HTMLElement} container
   * @param {RenderOptions} [options]
   * @returns {RenderResult}
   */
  renderDisplayData(displayData, container, options = {}) {
    const html = displayData.data['text/html'];
    if (!html) {
      return {
        container,
        scriptsExecuted: 0,
        scriptErrors: [],
      };
    }

    // Use scopeClass from metadata if available
    const scopeClass = options.scopeClass ?? displayData.metadata?.scopeClass;

    return this.render(html, container, {
      ...options,
      scopeClass: typeof scopeClass === 'string' ? scopeClass : undefined,
    });
  }

  /**
   * Render in direct mode (no isolation)
   * @param {string} html
   * @param {HTMLElement} container
   * @param {RenderOptions} options
   * @returns {RenderResult}
   */
  #renderDirect(html, container, options) {
    if (options.clear !== false) {
      container.innerHTML = '';
    }

    // Extract scripts before setting innerHTML
    const { content, scripts } = this.#extractScripts(html);

    // Append content
    const temp = document.createElement('div');
    temp.innerHTML = content;
    while (temp.firstChild) {
      container.appendChild(temp.firstChild);
    }

    // Execute scripts
    const { executed, errors } = this.#executeScripts(scripts, container, options);

    return {
      container,
      scriptsExecuted: executed,
      scriptErrors: errors,
    };
  }

  /**
   * Render in shadow mode (full isolation via Shadow DOM)
   * @param {string} html
   * @param {HTMLElement} container
   * @param {RenderOptions} options
   * @returns {RenderResult}
   */
  #renderShadow(html, container, options) {
    // Create or reuse shadow root
    let shadowRoot = container.shadowRoot;
    if (!shadowRoot) {
      shadowRoot = container.attachShadow({ mode: 'open' });
    }

    if (options.clear !== false) {
      shadowRoot.innerHTML = '';
    }

    // Extract scripts
    const { content, scripts } = this.#extractScripts(html);

    // Set content
    const temp = document.createElement('div');
    temp.innerHTML = content;
    while (temp.firstChild) {
      shadowRoot.appendChild(temp.firstChild);
    }

    // Execute scripts in shadow context
    const { executed, errors } = this.#executeScripts(scripts, shadowRoot, options);

    return {
      container,
      shadowRoot,
      scriptsExecuted: executed,
      scriptErrors: errors,
    };
  }

  /**
   * Render in scoped mode (CSS isolation via class prefixing)
   * @param {string} html
   * @param {HTMLElement} container
   * @param {RenderOptions} options
   * @returns {RenderResult}
   */
  #renderScoped(html, container, options) {
    const scopeClass = options.scopeClass ?? `mrmd-scope-${Date.now()}`;

    // Add scope class to container
    container.classList.add(scopeClass);

    if (options.clear !== false) {
      container.innerHTML = '';
    }

    // Extract scripts and styles
    const { content, scripts, styles } = this.#extractScriptsAndStyles(html);

    // Scope and append styles
    for (const style of styles) {
      const scopedCss = scopeStyles(style, `.${scopeClass}`);
      const styleEl = document.createElement('style');
      styleEl.textContent = scopedCss;
      container.appendChild(styleEl);
    }

    // Append content
    const temp = document.createElement('div');
    temp.innerHTML = content;
    while (temp.firstChild) {
      container.appendChild(temp.firstChild);
    }

    // Execute scripts
    const { executed, errors } = this.#executeScripts(scripts, container, options);

    return {
      container,
      scriptsExecuted: executed,
      scriptErrors: errors,
    };
  }

  /**
   * Extract scripts from HTML
   * @param {string} html
   * @returns {{ content: string, scripts: string[] }}
   */
  #extractScripts(html) {
    const scripts = [];
    const content = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, code) => {
      scripts.push(code.trim());
      return '';
    });
    return { content, scripts };
  }

  /**
   * Extract scripts and styles from HTML
   * @param {string} html
   * @returns {{ content: string, scripts: string[], styles: string[] }}
   */
  #extractScriptsAndStyles(html) {
    const scripts = [];
    const styles = [];

    let content = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, code) => {
      scripts.push(code.trim());
      return '';
    });

    content = content.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      styles.push(css.trim());
      return '';
    });

    return { content, scripts, styles };
  }

  /**
   * Execute scripts
   * @param {string[]} scripts
   * @param {HTMLElement | ShadowRoot} context
   * @param {RenderOptions} options
   * @returns {{ executed: number, errors: Error[] }}
   */
  #executeScripts(scripts, context, options) {
    if (options.executeScripts === false) {
      return { executed: 0, errors: [] };
    }

    let executed = 0;
    const errors = [];

    for (const code of scripts) {
      if (!code) continue;

      // Skip already executed scripts (deduplication by content hash)
      const hash = this.#hashCode(code);
      if (executedScripts.has(hash)) {
        continue;
      }
      executedScripts.add(hash);

      try {
        // Create script element for proper execution
        const script = document.createElement('script');
        script.textContent = code;

        // Add to document to execute
        if (context instanceof ShadowRoot) {
          context.appendChild(script);
        } else {
          context.appendChild(script);
        }

        executed++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        options.onScriptError?.(error, code);
      }
    }

    return { executed, errors };
  }

  /**
   * Simple hash function for deduplication
   * @param {string} str
   * @returns {string}
   */
  #hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clear executed scripts cache (for re-execution)
   * @param {string} [execId] - Clear specific execution, or all if not provided
   */
  clearScripts(execId) {
    if (execId) {
      this.#scriptHashes.delete(execId);
    } else {
      this.#scriptHashes.clear();
      executedScripts.clear();
    }
  }
}

/**
 * Scope CSS selectors with a prefix
 * @param {string} css
 * @param {string} scopeSelector
 * @returns {string}
 */
export function scopeStyles(css, scopeSelector) {
  // Simple CSS scoping - prefix each selector
  // This is a basic implementation; a full parser would be more robust

  return css.replace(
    /([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
    (match, selector, suffix) => {
      // Don't scope @-rules
      if (selector.trim().startsWith('@')) {
        return match;
      }

      // Don't scope :root, html, body
      const trimmed = selector.trim();
      if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') {
        return `${scopeSelector}${suffix}`;
      }

      // Scope the selector
      return `${scopeSelector} ${selector.trim()}${suffix}`;
    }
  );
}

/**
 * Create a new HTML renderer
 * @returns {HtmlRenderer}
 */
export function createHtmlRenderer() {
  return new HtmlRenderer();
}
