/**
 * LSP-like Features Module
 *
 * Runtime-powered completions, hover, and variable inspection.
 */

export {
  getCompletions,
  parseCompletionContext,
  type CompletionContext,
} from './completion';

export {
  getHoverInfo,
  parseIdentifierAtPosition,
  inspectObjectPath,
} from './hover';

export {
  getVariables,
  getVariableDetail,
  expandVariable,
} from './variables';
