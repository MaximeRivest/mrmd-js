/**
 * mrmd-js Type Definitions
 *
 * Core types for the JavaScript runtime and LSP-like features.
 */
/**
 * Result of code execution
 */
interface ExecutionResult {
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
interface ExecutionError {
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
interface DisplayData {
    /** MIME type */
    mimeType: string;
    /** Data content */
    data: string;
}
/**
 * Callback for streaming execution output
 */
type StreamCallback = (chunk: string, accumulated: string, done: boolean) => void;
/**
 * Completion result
 */
interface CompletionResult {
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
interface CompletionItem {
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
type CompletionType = 'variable' | 'function' | 'class' | 'property' | 'method' | 'constant' | 'keyword' | 'module';
/**
 * Hover/inspection result
 */
interface HoverResult {
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
interface VariableInfo {
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
/**
 * Sandbox configuration options
 */
interface SandboxOptions {
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
interface SandboxWindow extends Window {
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
interface OutputEntry {
    type: 'log' | 'error' | 'warn' | 'info';
    content: string;
    timestamp: number;
}
/**
 * JavaScript client options
 */
interface JavaScriptClientOptions {
    /** Sandbox configuration */
    sandbox?: SandboxOptions;
}
/**
 * Executor interface (matches mrmd-editor's Executor)
 */
interface Executor {
    /**
     * Execute code and return result
     */
    execute(code: string, language: string, execId?: string): Promise<ExecutionResult>;
    /**
     * Execute code with streaming output
     */
    executeStreaming(code: string, language: string, onChunk: StreamCallback, execId?: string): Promise<ExecutionResult>;
    /**
     * Check if executor supports a language
     */
    supports(language: string): boolean;
    /**
     * Clean up assets for a given execution ID
     */
    cleanupAssets?(execId: string): Promise<void>;
}

/**
 * JavaScript Client
 *
 * Main client class providing JavaScript execution with LSP-like features.
 * Combines the sandbox, completion, hover, and variable inspection capabilities.
 *
 * Usage:
 *   const client = new JavaScriptClient();
 *   await client.execute('const x = 1 + 2;');
 *   const completions = client.complete('x.toStr', 7);
 */

/**
 * JavaScript runtime client with LSP-like features
 */
declare class JavaScriptClient {
    private sandbox;
    private initialized;
    constructor(options?: JavaScriptClientOptions);
    /**
     * Ensure the sandbox is initialized
     */
    private ensureInitialized;
    /**
     * Get the sandbox execution context
     */
    private getContext;
    /**
     * Execute JavaScript code
     *
     * @param code - The code to execute
     * @returns Execution result with output, return value, and timing
     */
    execute(code: string): Promise<ExecutionResult>;
    /**
     * Execute code with streaming output
     *
     * Streams console output as it happens, useful for long-running code
     * or code that produces incremental output.
     *
     * @param code - The code to execute
     * @param onChunk - Callback for each output chunk
     * @returns Final execution result
     */
    executeStreaming(code: string, onChunk: StreamCallback): Promise<ExecutionResult>;
    /**
     * Get completions at cursor position
     *
     * @param code - The code being edited
     * @param cursorPos - Cursor position (0-indexed character offset)
     * @returns Completion items with position info
     */
    complete(code: string, cursorPos: number): CompletionResult;
    /**
     * Get hover information at cursor position
     *
     * @param code - The code being edited
     * @param cursorPos - Cursor position
     * @returns Hover info with type, value preview, and signature
     */
    hover(code: string, cursorPos: number): HoverResult;
    /**
     * Inspect an object by path
     *
     * @param path - Object path (e.g., "obj.prop" or "arr[0]")
     * @returns Object properties with type and value info
     */
    inspect(path: string): Record<string, unknown> | null;
    /**
     * Get all variables in scope
     *
     * @returns Array of variable information
     */
    variables(): VariableInfo[];
    /**
     * Expand a variable to see its children
     *
     * @param path - Variable path to expand
     * @returns Array of child variable info, or null if not expandable
     */
    expandVariable(path: string): VariableInfo[] | null;
    /**
     * Get all user-defined variables and their values
     *
     * @returns Object mapping variable names to values
     */
    getScope(): Record<string, unknown>;
    /**
     * Get a specific variable's value
     *
     * @param name - Variable name
     * @returns Variable value, or undefined if not found
     */
    getVariable(name: string): unknown;
    /**
     * Check if a variable exists in scope
     *
     * @param name - Variable name
     * @returns Whether the variable exists
     */
    hasVariable(name: string): boolean;
    /**
     * Check if this client is using the main window context
     */
    isMainContext(): boolean;
    /**
     * Get the iframe element (null if using main context)
     */
    getIframe(): HTMLIFrameElement | null;
    /**
     * Reset the runtime (clear all variables)
     */
    reset(): void;
    /**
     * Destroy the client and clean up resources
     */
    destroy(): void;
}

/**
 * JavaScript Executor
 *
 * Implements the Executor interface from mrmd-editor.
 * Wraps JavaScriptClient to provide a compatible interface.
 *
 * Usage in mrmd-editor:
 *   import { JavaScriptExecutor } from 'mrmd-js';
 *   const executor = new JavaScriptExecutor();
 *   const result = await executor.execute('console.log("Hello")', 'javascript');
 */

/**
 * JavaScript executor implementing the mrmd-editor Executor interface
 */
declare class JavaScriptExecutor implements Executor {
    private client;
    /**
     * Create a new JavaScript executor
     *
     * @param options - Client options
     */
    constructor(options?: JavaScriptClientOptions);
    /**
     * Get the underlying client for direct access to LSP features
     */
    getClient(): JavaScriptClient;
    /**
     * Execute code and return result
     *
     * @param code - The code to execute
     * @param language - Language identifier (must be javascript/js/jsx)
     * @param execId - Optional execution ID for tracking
     * @returns Execution result
     */
    execute(code: string, language: string, _execId?: string): Promise<ExecutionResult>;
    /**
     * Execute code with streaming output
     *
     * @param code - The code to execute
     * @param language - Language identifier
     * @param onChunk - Callback for each output chunk
     * @param execId - Optional execution ID
     * @returns Final execution result
     */
    executeStreaming(code: string, language: string, onChunk: StreamCallback, _execId?: string): Promise<ExecutionResult>;
    /**
     * Check if executor supports a language
     *
     * @param language - Language identifier to check
     * @returns Whether the language is supported
     */
    supports(language: string): boolean;
    /**
     * Clean up assets for a given execution ID
     *
     * JavaScript runtime doesn't create file assets, so this is a no-op.
     *
     * @param execId - Execution ID
     */
    cleanupAssets(_execId: string): Promise<void>;
    /**
     * Reset the runtime (clear all variables)
     */
    reset(): void;
    /**
     * Destroy the executor and clean up resources
     */
    destroy(): void;
}

/**
 * JavaScript Runtime
 *
 * Multi-scope runtime manager that allows creating multiple isolated
 * execution contexts (scopes). Each scope is a separate JavaScriptClient
 * with its own variables and state.
 *
 * Use cases:
 * - Multiple notebooks/documents open simultaneously
 * - Separate scopes for different visualizations/artifacts
 * - Main page context access alongside isolated execution
 *
 * Usage:
 *   const runtime = new JavaScriptRuntime();
 *
 *   // Default scope (isolated iframe)
 *   await runtime.execute('const x = 1');
 *
 *   // Named scopes (each isolated)
 *   const chart1 = runtime.scope('chart-1');
 *   const chart2 = runtime.scope('chart-2');
 *   await chart1.execute('const data = [1,2,3]');
 *   await chart2.execute('const data = [4,5,6]');
 *
 *   // Main page context
 *   await runtime.executeInMain('document.title');
 *
 *   // Visible artifact
 *   const viz = runtime.createArtifact('viz', document.getElementById('container'));
 *   await viz.execute('document.body.innerHTML = "<h1>Hello</h1>"');
 */

/**
 * Options for creating an artifact scope
 */
interface ArtifactOptions {
    /** CSS styles for the artifact iframe */
    styles?: Partial<CSSStyleDeclaration>;
    /** Additional sandbox options */
    sandbox?: Omit<SandboxOptions, 'targetElement' | 'iframeStyles'>;
}
/**
 * Multi-scope JavaScript runtime manager
 */
declare class JavaScriptRuntime {
    /** Named scopes (isolated iframes) */
    private scopes;
    /** Default scope */
    private defaultScope;
    /** Main context client (for executeInMain) */
    private mainClient;
    /** Default sandbox options for new scopes */
    private defaultOptions;
    constructor(options?: SandboxOptions);
    /**
     * Get or create the default scope
     */
    private getDefaultScope;
    /**
     * Execute code in the default scope
     */
    execute(code: string): Promise<ExecutionResult>;
    /**
     * Execute with streaming in the default scope
     */
    executeStreaming(code: string, onChunk: StreamCallback): Promise<ExecutionResult>;
    /**
     * Get completions in the default scope
     */
    complete(code: string, cursorPos: number): CompletionResult;
    /**
     * Get hover info in the default scope
     */
    hover(code: string, cursorPos: number): HoverResult;
    /**
     * Get variables in the default scope
     */
    variables(): VariableInfo[];
    /**
     * Reset the default scope
     */
    reset(): void;
    /**
     * Get completions for a specific scope
     */
    completeInScope(scopeName: string, code: string, cursorPos: number): CompletionResult;
    /**
     * Get hover info for a specific scope
     */
    hoverInScope(scopeName: string, code: string, cursorPos: number): HoverResult;
    /**
     * Get variables from a specific scope
     */
    variablesInScope(scopeName: string): VariableInfo[];
    /**
     * Get variables from ALL scopes (for cross-scope awareness)
     * Returns a map of scope name -> variables
     */
    allVariables(): Map<string, VariableInfo[]>;
    /**
     * Get or create a named scope
     *
     * Each scope is an isolated execution environment with its own variables.
     *
     * @param name - Unique name for the scope
     * @param options - Optional sandbox options for this scope
     * @returns JavaScriptClient for the scope
     */
    scope(name: string, options?: SandboxOptions): JavaScriptClient;
    /**
     * Check if a named scope exists
     */
    hasScope(name: string): boolean;
    /**
     * List all named scopes
     */
    listScopes(): string[];
    /**
     * Destroy a named scope
     */
    destroyScope(name: string): boolean;
    /**
     * Reset a named scope (clear variables but keep the scope)
     */
    resetScope(name: string): boolean;
    /**
     * Execute code in the main window context
     *
     * WARNING: This gives access to the page's variables and DOM.
     * Changes can affect the page's state.
     *
     * @param code - Code to execute
     * @returns Execution result
     */
    executeInMain(code: string): Promise<ExecutionResult>;
    /**
     * Get the main context client (creates if needed)
     *
     * Use this for completions/hover in main context.
     */
    getMainClient(): JavaScriptClient;
    /**
     * Create a visible artifact scope
     *
     * The artifact is rendered into the target element as a visible iframe.
     * Code can render to the iframe's document.
     *
     * @param name - Unique name for the artifact
     * @param targetElement - DOM element to render the artifact into
     * @param options - Optional artifact options
     * @returns JavaScriptClient for the artifact
     */
    createArtifact(name: string, targetElement: HTMLElement, options?: ArtifactOptions): JavaScriptClient;
    /**
     * Get an existing artifact by name
     */
    getArtifact(name: string): JavaScriptClient | undefined;
    /**
     * Destroy all scopes and clean up
     */
    destroy(): void;
    /**
     * Reset all scopes (clear variables but keep scopes)
     */
    resetAll(): void;
}

/**
 * Iframe Sandbox
 *
 * Provides an isolated JavaScript execution environment using a hidden iframe.
 * Variables persist in the iframe's global scope between executions.
 *
 * Features:
 * - Isolated global scope (doesn't pollute main page)
 * - Full browser environment (fetch, DOM APIs, etc.)
 * - Console interception for output capture
 * - Reset capability by destroying and recreating iframe
 */

/**
 * Iframe-based JavaScript sandbox
 *
 * Supports three modes:
 * 1. Isolated (default) - Hidden iframe, fully isolated
 * 2. Main context - Execute in main window (access page's state)
 * 3. Visible artifact - Iframe rendered into a target element
 */
declare class IframeSandbox {
    private iframe;
    private ctx;
    private options;
    private useMainContext;
    private originalConsole;
    constructor(options?: SandboxOptions);
    /**
     * Check if using main window context
     */
    isMainContext(): boolean;
    /**
     * Get the iframe element (null if using main context)
     */
    getIframe(): HTMLIFrameElement | null;
    /**
     * Initialize the sandbox (create iframe and set up environment)
     */
    initialize(): void;
    /**
     * Initialize using the main window context
     */
    private initializeMainContext;
    /**
     * Initialize using an iframe
     */
    private initializeIframe;
    /**
     * Set up utility functions in the sandbox
     */
    private setupUtilities;
    /**
     * Set up console interception to capture output
     */
    private setupConsoleInterception;
    /**
     * Restore original console methods (for main context cleanup)
     */
    private restoreConsole;
    /**
     * Execute code in the sandbox
     */
    execute(code: string): Promise<ExecutionResult>;
    /**
     * Format the return value for display
     */
    private formatResult;
    /**
     * Format an error for the result
     */
    private formatError;
    /**
     * Get all user-defined variables in the sandbox
     */
    getVariables(): Record<string, unknown>;
    /**
     * Get a specific variable's value
     */
    getVariable(name: string): unknown;
    /**
     * Check if a variable exists in the sandbox
     */
    hasVariable(name: string): boolean;
    /**
     * Get the execution context (for advanced use)
     */
    getContext(): SandboxWindow | null;
    /**
     * Reset the sandbox (clear all variables)
     */
    reset(): void;
    /**
     * Destroy the sandbox (remove iframe)
     */
    destroy(): void;
}

/**
 * Code Transformation for Variable Persistence
 *
 * Transforms JavaScript code so that top-level variable declarations
 * become global assignments, allowing them to persist across cell executions.
 *
 * Example:
 *   let x = 1;           ->  x = 1;
 *   const fn = () => {}  ->  fn = () => {}
 *   function foo() {}    ->  foo = function foo() {}
 *
 * Limitations:
 * - Uses regex-based transformation (not a full parser)
 * - Block-scoped variables inside functions remain scoped
 * - Complex destructuring patterns may not transform correctly
 */
/**
 * Transform code for persistence in global scope
 *
 * @param code - The original JavaScript code
 * @returns Transformed code with let/const/var removed from top-level
 */
declare function transformForPersistence(code: string): string;
/**
 * Wrap code in async IIFE for top-level await support
 *
 * @param code - The code to wrap
 * @returns Code wrapped in (async () => { ... })()
 */
declare function wrapForAsync(code: string): string;
/**
 * Extract variable names that would be declared by the code
 * Used for tracking user-defined variables
 *
 * @param code - The original (non-transformed) code
 * @returns Set of variable names
 */
declare function extractDeclaredVariables(code: string): Set<string>;

/**
 * Runtime-based Completion Provider
 *
 * Provides autocompletion by inspecting the live JavaScript runtime scope.
 * Unlike static LSP, this sees actual variable values and their types.
 */

/**
 * Parse code to find what's being completed
 */
interface CompletionContext {
    /** The word/identifier being typed */
    word: string;
    /** Position where the word starts */
    wordStart: number;
    /** Object being accessed (for property completion) */
    object?: string;
    /** Whether this is a property access (after .) */
    isPropertyAccess: boolean;
    /** Whether this is a method call context (after .) */
    isMethodAccess: boolean;
}
/**
 * Parse the completion context from code and cursor position
 */
declare function parseCompletionContext(code: string, cursorPos: number): CompletionContext;
/**
 * Get completions from the runtime scope
 */
declare function getCompletions(code: string, cursorPos: number, ctx: SandboxWindow | null, userVars: Record<string, unknown>): CompletionResult;

/**
 * Runtime-based Hover Provider
 *
 * Provides hover information by inspecting actual runtime values.
 * Shows real values, types, and function signatures.
 */

/**
 * Parse an identifier from code at a given position
 */
declare function parseIdentifierAtPosition(code: string, cursorPos: number): {
    name: string;
    start: number;
    end: number;
} | null;
/**
 * Get hover information for an identifier
 */
declare function getHoverInfo(code: string, cursorPos: number, ctx: SandboxWindow | null): HoverResult;
/**
 * Get detailed inspection of a specific object path
 * Used for drill-down in variable explorer
 */
declare function inspectObjectPath(path: string, ctx: SandboxWindow | null): Record<string, unknown> | null;

/**
 * Runtime Variable Explorer
 *
 * Lists and inspects variables in the JavaScript runtime scope.
 * Like RStudio's Environment pane or Jupyter's Variable Inspector.
 */

/**
 * Get information about all variables in scope
 */
declare function getVariables(userVars: Record<string, unknown>): VariableInfo[];
/**
 * Get detailed information about a specific variable
 */
declare function getVariableDetail(name: string, ctx: SandboxWindow | null): VariableInfo | null;
/**
 * Expand a variable to see its children (properties/elements)
 */
declare function expandVariable(path: string, ctx: SandboxWindow | null): VariableInfo[] | null;

/**
 * HTML Rendering Types
 *
 * Types for HTML cell rendering with multiple isolation modes.
 */
/**
 * HTML rendering mode
 *
 * - 'direct': Inject HTML directly into page DOM (styles/scripts affect page)
 * - 'shadow': Use Shadow DOM for full CSS/JS isolation
 * - 'scoped': Use CSS class prefixing for style isolation without Shadow DOM
 */
type RenderMode = 'direct' | 'shadow' | 'scoped';
/**
 * Options for HTML rendering
 */
interface RenderOptions {
    /**
     * Rendering mode
     * @default 'direct'
     */
    mode?: RenderMode;
    /**
     * Unique ID for this render (used for script deduplication and CSS scoping)
     */
    execId?: string;
    /**
     * Custom scope class name (for 'scoped' mode)
     * If not provided, will be generated from execId
     */
    scopeClass?: string;
    /**
     * Whether to execute scripts
     * @default true
     */
    executeScripts?: boolean;
    /**
     * Callback when a script error occurs
     */
    onScriptError?: (error: Error, script: string) => void;
}
/**
 * Result of extracting scripts and styles from HTML
 */
interface ExtractResult {
    /** HTML with scripts and styles removed */
    html: string;
    /** Extracted script contents */
    scripts: string[];
    /** Extracted style contents */
    styles: string[];
}
/**
 * Result of HTML rendering
 */
interface RenderResult {
    /** The container element that was rendered into */
    container: HTMLElement;
    /** Shadow root if shadow mode was used */
    shadowRoot?: ShadowRoot;
    /** Number of scripts executed */
    scriptsExecuted: number;
    /** Any script errors that occurred */
    scriptErrors: Error[];
}

/**
 * HTML Renderer
 *
 * Renders HTML content with three isolation modes:
 *
 * 1. **Direct** - Injects HTML directly into the page DOM
 *    - Styles and scripts affect the entire page
 *    - Fastest, but no isolation
 *    - Use when you trust the content and want page integration
 *
 * 2. **Shadow** - Uses Shadow DOM for complete isolation
 *    - Styles are fully encapsulated (don't leak in or out)
 *    - Scripts run in the shadow context
 *    - Best isolation, but some limitations (e.g., no :host styling from outside)
 *
 * 3. **Scoped** - Uses CSS class prefixing for style isolation
 *    - Styles are scoped via class prefixes (`.scope-123 .card {}`)
 *    - No Shadow DOM overhead
 *    - Good middle ground when you need style isolation but not full encapsulation
 */

/**
 * HTML Renderer class
 *
 * Provides methods for rendering HTML with different isolation strategies.
 */
declare class HtmlRenderer {
    /**
     * Render HTML into a container element
     *
     * @param html - HTML content to render
     * @param container - Target container element
     * @param options - Rendering options
     * @returns Render result with details about what was rendered
     */
    render(html: string, container: HTMLElement, options?: RenderOptions): RenderResult;
    /**
     * Render HTML directly into container (no isolation)
     */
    private renderDirect;
    /**
     * Render HTML into Shadow DOM (full isolation)
     */
    private renderShadow;
    /**
     * Render HTML with scoped CSS (class-based isolation)
     */
    private renderScoped;
    /**
     * Clear all tracked scripts for an execution ID
     * Call this before re-rendering to allow scripts to run again
     */
    clearScripts(execId: string): void;
}
/**
 * Create a new HtmlRenderer instance
 */
declare function createHtmlRenderer(): HtmlRenderer;
/**
 * Convenience function to render HTML without creating a renderer instance
 */
declare function renderHtml(html: string, container: HTMLElement, options?: RenderOptions): RenderResult;

/**
 * Execute scripts for a cell, skipping any that have already run
 *
 * @param execId - Unique execution ID for this cell/render
 * @param scripts - Array of script contents to execute
 * @param context - The element or shadow root to use as `this` context
 * @param onError - Optional callback for script errors
 * @returns Number of scripts actually executed (not skipped)
 */
declare function executeScripts(execId: string, scripts: string[], context: Element | ShadowRoot, onError?: (error: Error, script: string) => void): number;
/**
 * Clear tracked scripts for a specific execution ID
 * Call this before re-executing a cell to allow scripts to run again
 *
 * @param execId - Execution ID to clear
 */
declare function clearScripts(execId: string): void;
/**
 * Clear all tracked scripts across all execution IDs
 * Useful when resetting the entire runtime
 */
declare function clearAllScripts(): void;
/**
 * Check if any scripts have been executed for an execution ID
 *
 * @param execId - Execution ID to check
 */
declare function hasExecutedScripts(execId: string): boolean;

/**
 * HTML Utilities
 *
 * Functions for extracting and processing HTML content:
 * - Extract <script> tags from HTML
 * - Extract <style> tags from HTML
 * - Scope CSS selectors with a prefix class
 */

/**
 * Extract script tags from HTML, returning cleaned HTML and script contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of script contents
 */
declare function extractScripts(html: string): {
    html: string;
    scripts: string[];
};
/**
 * Extract style tags from HTML, returning cleaned HTML and style contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of style contents
 */
declare function extractStyles(html: string): {
    html: string;
    styles: string[];
};
/**
 * Extract both scripts and styles from HTML
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML, scripts array, and styles array
 */
declare function extractScriptsAndStyles(html: string): ExtractResult;
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
declare function scopeStyles(css: string, scopeSelector: string): string;
/**
 * Generate a valid CSS class name from an execution ID
 *
 * @param execId - Execution ID (e.g., 'exec-1234567890-abc12')
 * @returns Valid CSS class name (e.g., 'mrmd-scope-exec1234567890abc12')
 */
declare function generateScopeClass(execId: string): string;

export { HtmlRenderer, IframeSandbox, JavaScriptClient, JavaScriptExecutor, JavaScriptRuntime, clearAllScripts, clearScripts, createHtmlRenderer, executeScripts, expandVariable, extractDeclaredVariables, extractScripts, extractScriptsAndStyles, extractStyles, generateScopeClass, getCompletions, getHoverInfo, getVariableDetail, getVariables, hasExecutedScripts, inspectObjectPath, parseCompletionContext, parseIdentifierAtPosition, renderHtml, scopeStyles, transformForPersistence, wrapForAsync };
export type { ArtifactOptions, CompletionContext, CompletionItem, CompletionResult, CompletionType, DisplayData, ExecutionError, ExecutionResult, Executor, ExtractResult, HoverResult, JavaScriptClientOptions, OutputEntry, RenderMode, RenderOptions, RenderResult, SandboxOptions, SandboxWindow, StreamCallback, VariableInfo };
