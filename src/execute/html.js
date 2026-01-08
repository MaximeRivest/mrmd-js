/**
 * HTML Executor
 *
 * Executes HTML cells by producing displayData with text/html MIME type.
 * Optionally extracts and executes inline scripts.
 *
 * @module execute/html
 */

import { BaseExecutor } from './interface.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/execution.js').DisplayData} DisplayData
 */

/**
 * Regex to match script tags and capture their content
 */
const SCRIPT_REGEX = /<script[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Regex to match style tags and capture their content
 */
const STYLE_REGEX = /<style[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * Extract script tags from HTML
 * @param {string} html
 * @returns {{ html: string, scripts: string[] }}
 */
function extractScripts(html) {
  const scripts = [];

  const cleaned = html.replace(SCRIPT_REGEX, (_, content) => {
    if (content.trim()) {
      scripts.push(content);
    }
    return '';
  });

  return { html: cleaned, scripts };
}

/**
 * Extract style tags from HTML
 * @param {string} html
 * @returns {{ html: string, styles: string[] }}
 */
function extractStyles(html) {
  const styles = [];

  const cleaned = html.replace(STYLE_REGEX, (_, content) => {
    if (content.trim()) {
      styles.push(content);
    }
    return '';
  });

  return { html: cleaned, styles };
}

/**
 * HTML executor - produces displayData for HTML content
 */
export class HtmlExecutor extends BaseExecutor {
  /** @type {readonly string[]} */
  languages = ['html', 'htm', 'xhtml'];

  /**
   * Execute HTML cell
   * @param {string} code - HTML content
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, context, options = {}) {
    const startTime = performance.now();

    // Extract scripts and styles
    const { html: htmlWithoutScripts, scripts } = extractScripts(code);
    const { html: cleanHtml, styles } = extractStyles(htmlWithoutScripts);

    // Build display data
    /** @type {DisplayData[]} */
    const displayData = [];

    // Main HTML content
    displayData.push({
      data: {
        'text/html': code, // Send original HTML including scripts/styles
      },
      metadata: {
        // Metadata for client to decide how to render
        hasScripts: scripts.length > 0,
        hasStyles: styles.length > 0,
        scriptCount: scripts.length,
        styleCount: styles.length,
        trusted: options.cellMeta?.trusted ?? false,
        // Client can use this to decide whether to execute scripts
        executeScripts: options.cellMeta?.executeScripts ?? true,
      },
    });

    // Optionally include cleaned HTML (without scripts/styles) as alternate
    if (scripts.length > 0 || styles.length > 0) {
      displayData.push({
        data: {
          'text/html+safe': cleanHtml.trim(),
        },
        metadata: {
          description: 'HTML content with scripts and styles removed',
        },
      });
    }

    // Include extracted styles as separate CSS display data
    if (styles.length > 0) {
      displayData.push({
        data: {
          'text/css': styles.join('\n\n'),
        },
        metadata: {
          source: 'extracted',
          description: 'Styles extracted from HTML',
        },
      });
    }

    const duration = performance.now() - startTime;

    // Build info message
    const parts = [];
    if (cleanHtml.trim()) parts.push('HTML');
    if (styles.length > 0) parts.push(`${styles.length} style${styles.length > 1 ? 's' : ''}`);
    if (scripts.length > 0) parts.push(`${scripts.length} script${scripts.length > 1 ? 's' : ''}`);

    return {
      success: true,
      stdout: `Rendered: ${parts.join(', ') || 'empty'}`,
      stderr: '',
      result: undefined,
      displayData,
      assets: [],
      executionCount: 0,
      duration,
    };
  }
}

/**
 * Create an HTML executor
 * @returns {HtmlExecutor}
 */
export function createHtmlExecutor() {
  return new HtmlExecutor();
}

// Export utilities for use by clients
export { extractScripts, extractStyles };
