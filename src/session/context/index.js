/**
 * Execution Contexts
 *
 * Different execution environments for JavaScript code.
 * @module session/context
 */

export { IframeContext, createIframeContext } from './iframe.js';
export { MainContext, createMainContext } from './main.js';

// Re-export interface types
export * from './interface.js';
