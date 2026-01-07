/**
 * HTML Utilities
 *
 * Functions for extracting and processing HTML content:
 * - Extract <script> tags from HTML
 * - Extract <style> tags from HTML
 * - Scope CSS selectors with a prefix class
 */

import type { ExtractResult } from './types';

/**
 * Regex to match script tags and capture their content
 * Handles: <script>, <script type="...">, <script src="...">
 * Captures the content between opening and closing tags
 */
const SCRIPT_REGEX = /<script[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Regex to match style tags and capture their content
 */
const STYLE_REGEX = /<style[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * Extract script tags from HTML, returning cleaned HTML and script contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of script contents
 */
export function extractScripts(html: string): { html: string; scripts: string[] } {
  const scripts: string[] = [];

  const cleaned = html.replace(SCRIPT_REGEX, (_, content) => {
    if (content.trim()) {
      scripts.push(content);
    }
    return '';
  });

  return { html: cleaned, scripts };
}

/**
 * Extract style tags from HTML, returning cleaned HTML and style contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of style contents
 */
export function extractStyles(html: string): { html: string; styles: string[] } {
  const styles: string[] = [];

  const cleaned = html.replace(STYLE_REGEX, (_, content) => {
    if (content.trim()) {
      styles.push(content);
    }
    return '';
  });

  return { html: cleaned, styles };
}

/**
 * Extract both scripts and styles from HTML
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML, scripts array, and styles array
 */
export function extractScriptsAndStyles(html: string): ExtractResult {
  const scripts: string[] = [];
  const styles: string[] = [];

  let cleaned = html.replace(SCRIPT_REGEX, (_, content) => {
    if (content.trim()) {
      scripts.push(content);
    }
    return '';
  });

  cleaned = cleaned.replace(STYLE_REGEX, (_, content) => {
    if (content.trim()) {
      styles.push(content);
    }
    return '';
  });

  return { html: cleaned, scripts, styles };
}

/**
 * Scope CSS selectors by prefixing them with a class selector
 *
 * This provides style isolation without Shadow DOM by ensuring all
 * selectors only match elements within a container with the scope class.
 *
 * @param css - CSS string to scope
 * @param scopeSelector - The scope selector (e.g., '.cm-scope-abc123')
 * @returns CSS with all selectors prefixed
 *
 * @example
 * scopeStyles('.card { color: red; }', '.scope-123')
 * // Returns: '.scope-123 .card { color: red; }'
 *
 * scopeStyles('div, p { margin: 0; }', '.scope-123')
 * // Returns: '.scope-123 div, .scope-123 p { margin: 0; }'
 */
export function scopeStyles(css: string, scopeSelector: string): string {
  // Match selector blocks (everything before a {)
  // This is a simplified implementation that handles most common cases
  return css.replace(
    /([^{}]+)\{/g,
    (_match, selectors: string) => {
      const scoped = selectors
        .split(',')
        .map((selector: string) => {
          const trimmed = selector.trim();

          // Don't scope special selectors
          if (
            // @-rules (media, keyframes, supports, etc.)
            trimmed.startsWith('@') ||
            // Keyframe percentages and keywords
            trimmed.startsWith('from') ||
            trimmed.startsWith('to') ||
            /^\d+%$/.test(trimmed) ||
            // Empty selector
            !trimmed
          ) {
            return trimmed;
          }

          // Handle :root specially - replace with scope selector
          if (trimmed === ':root') {
            return scopeSelector;
          }

          // Handle :host (for shadow DOM compatibility)
          if (trimmed === ':host') {
            return scopeSelector;
          }

          // Prefix the selector
          return `${scopeSelector} ${trimmed}`;
        })
        .join(', ');

      return `${scoped} {`;
    }
  );
}

/**
 * Generate a valid CSS class name from an execution ID
 *
 * @param execId - Execution ID (e.g., 'exec-1234567890-abc12')
 * @returns Valid CSS class name (e.g., 'mrmd-scope-exec1234567890abc12')
 */
export function generateScopeClass(execId: string): string {
  // Remove non-alphanumeric characters and prefix
  const sanitized = execId.replace(/[^a-z0-9]/gi, '');
  return `mrmd-scope-${sanitized}`;
}

/**
 * Create a style element with the given CSS content
 *
 * @param css - CSS content
 * @returns HTMLStyleElement
 */
export function createStyleElement(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  return style;
}

/**
 * Parse HTML string into a DocumentFragment
 * This properly handles all HTML elements including scripts and styles
 *
 * @param html - HTML string to parse
 * @returns DocumentFragment containing the parsed nodes
 */
export function parseHtml(html: string): DocumentFragment {
  const range = document.createRange();
  return range.createContextualFragment(html);
}
