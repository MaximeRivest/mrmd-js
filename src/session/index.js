/**
 * Session Management
 *
 * Session and context management for mrmd-js.
 * @module session
 */

// Session classes
export { Session, createSession } from './session.js';
export { SessionManager, createSessionManager } from './manager.js';

// Context infrastructure
export { ConsoleCapture, createConsoleCapture } from './console-capture.js';
export { IframeContext, createIframeContext } from './context/iframe.js';
export { MainContext, createMainContext } from './context/main.js';
export * from './context/interface.js';
