/**
 * LSP Features
 *
 * Language Server Protocol-like features for JavaScript runtime.
 * These provide completions, hover, inspection, and variable listing
 * based on live runtime values.
 *
 * @module lsp
 */

// Parsing utilities
export {
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
} from './parse.js';

// Value formatting
export {
  formatValue,
  formatValueShort,
  getTypeName,
  getCompletionKind,
  isExpandable,
  getFunctionSignature,
  getFunctionSource,
  getSizeDescription,
} from './format.js';

// Completions
export { getCompletions } from './complete.js';

// Hover
export { getHoverInfo } from './hover.js';

// Inspection
export { getInspectInfo, inspectPath } from './inspect.js';

// Variables
export {
  listVariables,
  getVariableDetail,
  expandVariable,
  formatVariableInfo,
  getChildren,
  getMethods,
  getAttributes,
} from './variables.js';
