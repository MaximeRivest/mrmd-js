/**
 * CSS Applicator
 *
 * Utility for applying CSS displayData from cell execution.
 * Manages stylesheet lifecycle and scoping.
 *
 * @module utils/css-applicator
 */

/**
 * @typedef {Object} ApplyOptions
 * @property {string} [id] - Style element ID for updates
 * @property {string} [scope] - Scope selector to prefix rules
 * @property {boolean} [append=false] - Append instead of replace
 */

/**
 * @typedef {Object} ApplyResult
 * @property {HTMLStyleElement} element - The style element
 * @property {string} id - Style element ID
 * @property {boolean} replaced - Whether an existing style was replaced
 */

import { scopeStyles } from './html-renderer.js';

/**
 * CSS Applicator class
 */
export class CssApplicator {
  /** @type {Map<string, HTMLStyleElement>} */
  #styles = new Map();

  /** @type {HTMLElement} */
  #container;

  /**
   * Create CSS applicator
   * @param {HTMLElement} [container=document.head] - Container for style elements
   */
  constructor(container) {
    this.#container = container ?? document.head;
  }

  /**
   * Apply CSS string
   *
   * @param {string} css - CSS string
   * @param {ApplyOptions} [options]
   * @returns {ApplyResult}
   */
  apply(css, options = {}) {
    const id = options.id ?? `mrmd-style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Scope CSS if requested
    let processedCss = css;
    if (options.scope) {
      processedCss = scopeStyles(css, options.scope);
    }

    // Check for existing style with same ID
    let element = this.#styles.get(id);
    let replaced = false;

    if (element) {
      if (options.append) {
        element.textContent += '\n' + processedCss;
      } else {
        element.textContent = processedCss;
        replaced = true;
      }
    } else {
      element = document.createElement('style');
      element.id = id;
      element.textContent = processedCss;
      this.#container.appendChild(element);
      this.#styles.set(id, element);
    }

    return { element, id, replaced };
  }

  /**
   * Apply CSS from displayData
   *
   * @param {import('../types/execution.js').DisplayData} displayData
   * @param {ApplyOptions} [options]
   * @returns {ApplyResult | null}
   */
  applyDisplayData(displayData, options = {}) {
    const css = displayData.data['text/css'];
    if (!css) return null;

    // Use metadata for options if available
    const id = options.id ?? (displayData.metadata?.id ? String(displayData.metadata.id) : undefined);
    const scope = options.scope ?? (displayData.metadata?.scope ? String(displayData.metadata.scope) : undefined);

    return this.apply(css, { ...options, id, scope });
  }

  /**
   * Remove a style by ID
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const element = this.#styles.get(id);
    if (!element) return false;

    element.remove();
    this.#styles.delete(id);
    return true;
  }

  /**
   * Remove all managed styles
   */
  clear() {
    for (const element of this.#styles.values()) {
      element.remove();
    }
    this.#styles.clear();
  }

  /**
   * Get all managed style IDs
   * @returns {string[]}
   */
  list() {
    return Array.from(this.#styles.keys());
  }

  /**
   * Get a style element by ID
   * @param {string} id
   * @returns {HTMLStyleElement | undefined}
   */
  get(id) {
    return this.#styles.get(id);
  }
}

/**
 * Create a CSS applicator
 * @param {HTMLElement} [container]
 * @returns {CssApplicator}
 */
export function createCssApplicator(container) {
  return new CssApplicator(container);
}
