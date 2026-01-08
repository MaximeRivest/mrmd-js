/**
 * CSS Executor
 *
 * Executes CSS cells by producing displayData with text/css MIME type.
 * Supports optional scoping to prevent style leakage.
 *
 * @module execute/css
 */

import { BaseExecutor } from './interface.js';

/**
 * @typedef {import('../session/context/interface.js').ExecutionContext} ExecutionContext
 * @typedef {import('../types/execution.js').ExecuteOptions} ExecuteOptions
 * @typedef {import('../types/execution.js').ExecutionResult} ExecutionResult
 * @typedef {import('../types/execution.js').DisplayData} DisplayData
 */

/**
 * Generate a unique scope class name
 * @param {string} [id] - Optional ID to include
 * @returns {string}
 */
export function generateScopeClass(id) {
  const suffix = id
    ? id.replace(/[^a-z0-9]/gi, '')
    : Math.random().toString(36).slice(2, 8);
  return `mrmd-scope-${suffix}`;
}

/**
 * Scope CSS selectors by prefixing them with a scope selector
 *
 * @param {string} css - CSS content
 * @param {string} scopeSelector - Scope selector (e.g., '.mrmd-scope-abc123')
 * @returns {string} Scoped CSS
 *
 * @example
 * scopeStyles('.card { color: red; }', '.scope-123')
 * // Returns: '.scope-123 .card { color: red; }'
 */
export function scopeStyles(css, scopeSelector) {
  return css.replace(
    /([^{}]+)\{/g,
    (match, selectors) => {
      const scoped = selectors
        .split(',')
        .map((selector) => {
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

          // Handle * selector
          if (trimmed === '*') {
            return `${scopeSelector} *`;
          }

          // Handle html/body - scope to container instead
          if (trimmed === 'html' || trimmed === 'body') {
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
 * Parse CSS to extract rule information
 * @param {string} css
 * @returns {{ rules: number, selectors: string[], variables: string[] }}
 */
function parseCssInfo(css) {
  const selectors = [];
  const variables = [];

  // Count rules (rough estimate by counting {)
  const rules = (css.match(/\{/g) || []).length;

  // Extract selectors (before {)
  const selectorMatches = css.match(/([^{}]+)\{/g) || [];
  for (const match of selectorMatches) {
    const selector = match.replace('{', '').trim();
    if (selector && !selector.startsWith('@')) {
      selectors.push(...selector.split(',').map((s) => s.trim()));
    }
  }

  // Extract CSS custom properties (--var-name)
  const varMatches = css.match(/--[\w-]+/g) || [];
  variables.push(...new Set(varMatches));

  return { rules, selectors: selectors.slice(0, 10), variables: variables.slice(0, 10) };
}

/**
 * CSS executor - produces displayData for CSS content
 */
export class CssExecutor extends BaseExecutor {
  /** @type {readonly string[]} */
  languages = ['css', 'style', 'stylesheet'];

  /**
   * Execute CSS cell
   * @param {string} code - CSS content
   * @param {ExecutionContext} context - Execution context
   * @param {ExecuteOptions} [options] - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async execute(code, context, options = {}) {
    const startTime = performance.now();

    // Determine if scoping is requested
    const shouldScope = options.cellMeta?.scoped ?? options.cellMeta?.scope ?? false;
    const scopeId = options.execId || options.cellId || `css-${Date.now()}`;
    const scopeClass = shouldScope ? generateScopeClass(scopeId) : undefined;

    // Apply scoping if requested
    const processedCss = scopeClass ? scopeStyles(code, `.${scopeClass}`) : code;

    // Parse CSS for info
    const info = parseCssInfo(code);

    // Build display data
    /** @type {DisplayData[]} */
    const displayData = [
      {
        data: {
          'text/css': processedCss,
        },
        metadata: {
          // Original CSS (before scoping)
          original: code !== processedCss ? code : undefined,
          // Scoping info
          scoped: !!scopeClass,
          scopeClass,
          // CSS info
          ruleCount: info.rules,
          selectors: info.selectors,
          customProperties: info.variables,
          // Client hints
          inject: options.cellMeta?.inject ?? true,
          target: options.cellMeta?.target,
        },
      },
    ];

    const duration = performance.now() - startTime;

    // Build info message
    const parts = [`${info.rules} rule${info.rules !== 1 ? 's' : ''}`];
    if (scopeClass) {
      parts.push(`scoped to .${scopeClass}`);
    }
    if (info.variables.length > 0) {
      parts.push(`${info.variables.length} variable${info.variables.length !== 1 ? 's' : ''}`);
    }

    return {
      success: true,
      stdout: `CSS: ${parts.join(', ')}`,
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
 * Create a CSS executor
 * @returns {CssExecutor}
 */
export function createCssExecutor() {
  return new CssExecutor();
}
