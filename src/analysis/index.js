/**
 * Code Analysis
 *
 * Utilities for analyzing JavaScript code including completeness
 * checking and formatting.
 *
 * @module analysis
 */

export { isComplete, getSuggestedIndent } from './is-complete.js';
export {
  formatCode,
  basicFormat,
  formatHtml,
  formatCss,
  setPrettier,
  hasPrettier,
} from './format.js';
