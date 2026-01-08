/**
 * Completion Types
 *
 * Types for code completion (MRP /complete endpoint).
 * @module types/completion
 */

/**
 * @typedef {'invoked' | 'character' | 'incomplete'} TriggerKind
 */

/**
 * @typedef {Object} CompleteOptions
 * @property {string} [session] - Session ID
 * @property {TriggerKind} [triggerKind='invoked'] - What triggered completion
 * @property {string} [triggerCharacter] - Character that triggered
 */

/**
 * @typedef {'runtime' | 'lsp' | 'static'} CompletionSource
 */

/**
 * @typedef {Object} CompletionResult
 * @property {CompletionItem[]} matches - Completion items
 * @property {number} cursorStart - Start of text to replace
 * @property {number} cursorEnd - End of text to replace
 * @property {CompletionSource} source - Where completions came from
 */

/**
 * @typedef {'variable' | 'function' | 'method' | 'property' | 'class' | 'module' | 'keyword' | 'constant' | 'field' | 'value' | 'snippet'} CompletionKind
 */

/**
 * @typedef {Object} CompletionItem
 * @property {string} label - Display label
 * @property {string} [insertText] - Text to insert (if different from label)
 * @property {CompletionKind} kind - Item kind for icon
 * @property {string} [detail] - Short description
 * @property {string} [documentation] - Documentation (markdown)
 * @property {string} [valuePreview] - Live value preview (from runtime)
 * @property {string} [type] - Type string
 * @property {number} [sortPriority] - Sort priority (lower = higher)
 */

export {};
