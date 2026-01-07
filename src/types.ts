/**
 * mrmd-js Type Definitions
 *
 * Core types for the JavaScript runtime and LSP-like features.
 */

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Result of code execution
 */
export interface ExecutionResult {
  /** Whether execution completed without errors */
  success: boolean;
  /** Standard output (console.log, etc.) */
  stdout: string;
  /** Standard error (console.error, console.warn) */
  stderr: string;
  /** Return value of the code (last expression or explicit return) */
  result?: unknown;
  /** Formatted string representation of result */
  resultString?: string;
  /** Error information if execution failed */
  error?: ExecutionError;
  /** Execution time in milliseconds */
  duration?: number;
  /** Display data (HTML, images, etc.) */
  displayData?: DisplayData[];
}

/**
 * Execution error details
 */
export interface ExecutionError {
  /** Error name (e.g., "TypeError", "SyntaxError") */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace lines */
  stack?: string[];
}

/**
 * Rich display output
 */
export interface DisplayData {
  /** MIME type */
  mimeType: string;
  /** Data content */
  data: string;
}

/**
 * Callback for streaming execution output
 */
export type StreamCallback = (
  chunk: string,
  accumulated: string,
  done: boolean
) => void;

// =============================================================================
// LSP-like Types
// =============================================================================

/**
 * Completion result
 */
export interface CompletionResult {
  /** Completion items */
  items: CompletionItem[];
  /** Start position of the text being completed */
  from: number;
  /** End position of the text being completed */
  to: number;
}

/**
 * Single completion item
 */
export interface CompletionItem {
  /** Display label */
  label: string;
  /** Type of completion (variable, function, property, etc.) */
  type: CompletionType;
  /** Additional detail text */
  detail?: string;
  /** Documentation */
  documentation?: string;
  /** Text to insert (defaults to label) */
  insertText?: string;
}

/**
 * Completion item types
 */
export type CompletionType =
  | 'variable'
  | 'function'
  | 'class'
  | 'property'
  | 'method'
  | 'constant'
  | 'keyword'
  | 'module';

/**
 * Hover/inspection result
 */
export interface HoverResult {
  /** Whether information was found */
  found: boolean;
  /** Name of the inspected item */
  name: string;
  /** Type information */
  type: string;
  /** Value preview (truncated if large) */
  value?: string;
  /** Function signature if applicable */
  signature?: string;
  /** Documentation string */
  documentation?: string;
}

/**
 * Variable information for explorer
 */
export interface VariableInfo {
  /** Variable name */
  name: string;
  /** Type (typeof + constructor) */
  type: string;
  /** Value preview */
  value: string;
  /** Size information for arrays/objects */
  size?: string;
  /** Whether the variable is expandable (object/array) */
  expandable?: boolean;
}

// =============================================================================
// Sandbox Types
// =============================================================================

/**
 * Sandbox configuration options
 */
export interface SandboxOptions {
  /**
   * Whether to allow access to the main document
   * Enables ctx.mainDocument and ctx.mainWindow
   * @default true
   */
  allowMainDocumentAccess?: boolean;

  /**
   * Execute code in the main window context instead of an isolated iframe.
   * This gives access to the page's existing variables, DOM, and state.
   * WARNING: Can modify the page and pollute global scope.
   * @default false
   */
  useMainContext?: boolean;

  /**
   * DOM element to render the iframe into (makes it visible).
   * If provided, the iframe becomes a visible "artifact" that code can render to.
   * If not provided, the iframe is hidden.
   */
  targetElement?: HTMLElement;

  /**
   * CSS styles to apply to the iframe when using targetElement.
   * @default { width: '100%', height: '100%', border: 'none' }
   */
  iframeStyles?: Partial<CSSStyleDeclaration>;

  /**
   * Custom utilities to inject into the sandbox
   * These become available as globals in the execution context
   */
  utilities?: Record<string, unknown>;

  /**
   * Callback when console.log is called
   */
  onConsoleLog?: (...args: unknown[]) => void;

  /**
   * Callback when console.error is called
   */
  onConsoleError?: (...args: unknown[]) => void;

  /**
   * Callback when console.warn is called
   */
  onConsoleWarn?: (...args: unknown[]) => void;
}

/**
 * Extended window interface for the sandbox iframe
 */
export interface SandboxWindow extends Window {
  /** Reference to main document (if allowed) */
  mainDocument?: Document;
  /** Reference to main window (if allowed) */
  mainWindow?: Window;
  /** Sleep helper */
  sleep: (ms: number) => Promise<void>;
  /** Print helper (alias for console.log) */
  print: (...args: unknown[]) => void;
  /** Display helper for rich output */
  display: (data: unknown, mimeType?: string) => void;
  /** Output queue for captured console output */
  __outputQueue__: OutputEntry[];
  /** Display data queue for rich output */
  __displayQueue__: DisplayData[];
  /** Track user-defined variables */
  __userVars__: Set<string>;
  /** Console object (inherited from Window but redeclared for clarity) */
  console: Console;
  /** Eval function (inherited from Window but redeclared for clarity) */
  eval: (code: string) => unknown;
}

/**
 * Captured output entry
 */
export interface OutputEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  content: string;
  timestamp: number;
}

// =============================================================================
// Client Types
// =============================================================================

/**
 * JavaScript client options
 */
export interface JavaScriptClientOptions {
  /** Sandbox configuration */
  sandbox?: SandboxOptions;
}

// =============================================================================
// Executor Types (compatible with mrmd-editor)
// =============================================================================

/**
 * Executor interface (matches mrmd-editor's Executor)
 */
export interface Executor {
  /**
   * Execute code and return result
   */
  execute(code: string, language: string, execId?: string): Promise<ExecutionResult>;

  /**
   * Execute code with streaming output
   */
  executeStreaming(
    code: string,
    language: string,
    onChunk: StreamCallback,
    execId?: string
  ): Promise<ExecutionResult>;

  /**
   * Check if executor supports a language
   */
  supports(language: string): boolean;

  /**
   * Clean up assets for a given execution ID
   */
  cleanupAssets?(execId: string): Promise<void>;
}
