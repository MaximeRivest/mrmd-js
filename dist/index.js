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
function transformForPersistence(code) {
    const lines = code.split('\n');
    const transformed = [];
    let inMultiLineComment = false;
    let braceDepth = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        // Track multi-line comments
        if (trimmed.includes('/*') && !trimmed.includes('*/')) {
            inMultiLineComment = true;
        }
        if (trimmed.includes('*/')) {
            inMultiLineComment = false;
        }
        // Skip comment lines
        if (inMultiLineComment ||
            trimmed.startsWith('//') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('/*')) {
            transformed.push(line);
            continue;
        }
        // Track brace depth to identify top-level code
        // This is a simple heuristic - not perfect but works for most cases
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        // Only transform at top level (braceDepth === 0)
        if (braceDepth === 0) {
            const transformedLine = transformLine(line);
            transformed.push(transformedLine);
        }
        else {
            transformed.push(line);
        }
        braceDepth += openBraces - closeBraces;
        if (braceDepth < 0)
            braceDepth = 0; // Safety check
    }
    return transformed.join('\n');
}
/**
 * Transform a single line of code
 */
function transformLine(line) {
    // Match let/const/var declarations
    // Pattern: (whitespace)(let|const|var) (rest of declaration)
    const declMatch = line.match(/^(\s*)(let|const|var)\s+(.+)$/);
    if (declMatch) {
        const [, indent, , rest] = declMatch;
        // Handle destructuring: const { a, b } = obj or const [a, b] = arr
        if (rest.trim().startsWith('{') || rest.trim().startsWith('[')) {
            // Wrap destructuring in parens to make it an expression statement
            const assignment = rest.replace(/;?\s*$/, '');
            return `${indent}(${assignment});`;
        }
        // Regular declaration: just remove the keyword
        // let x = 1, y = 2;  ->  x = 1, y = 2;
        return `${indent}${rest}`;
    }
    // Match function declarations: function foo() {}
    const fnMatch = line.match(/^(\s*)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (fnMatch) {
        // Convert: function foo(  ->  foo = function foo(
        return line.replace(/^(\s*)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/, `$1$2 = function $2(`);
    }
    // Match class declarations: class Foo {}
    const classMatch = line.match(/^(\s*)class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (classMatch) {
        // Convert: class Foo  ->  Foo = class Foo
        return line.replace(/^(\s*)class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/, `$1$2 = class $2`);
    }
    return line;
}
/**
 * Wrap code in async IIFE for top-level await support
 *
 * @param code - The code to wrap
 * @returns Code wrapped in (async () => { ... })()
 */
function wrapForAsync(code) {
    return `(async () => {\n${code}\n})()`;
}
/**
 * Extract variable names that would be declared by the code
 * Used for tracking user-defined variables
 *
 * @param code - The original (non-transformed) code
 * @returns Set of variable names
 */
function extractDeclaredVariables(code) {
    const variables = new Set();
    // Match let/const/var declarations
    const declRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    while ((match = declRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }
    // Match function declarations
    const fnRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    while ((match = fnRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }
    // Match class declarations
    const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    while ((match = classRegex.exec(code)) !== null) {
        variables.add(match[1]);
    }
    return variables;
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
class IframeSandbox {
    constructor(options = {}) {
        this.iframe = null;
        this.ctx = null;
        this.originalConsole = null;
        this.options = options;
        this.useMainContext = options.useMainContext ?? false;
    }
    /**
     * Check if using main window context
     */
    isMainContext() {
        return this.useMainContext;
    }
    /**
     * Get the iframe element (null if using main context)
     */
    getIframe() {
        return this.iframe;
    }
    /**
     * Initialize the sandbox (create iframe and set up environment)
     */
    initialize() {
        if (this.useMainContext) {
            this.initializeMainContext();
        }
        else {
            this.initializeIframe();
        }
    }
    /**
     * Initialize using the main window context
     */
    initializeMainContext() {
        // Use the main window as context
        this.ctx = window;
        // Initialize output queues on main window (prefixed to avoid conflicts)
        if (!this.ctx.__outputQueue__) {
            this.ctx.__outputQueue__ = [];
        }
        if (!this.ctx.__displayQueue__) {
            this.ctx.__displayQueue__ = [];
        }
        if (!this.ctx.__userVars__) {
            this.ctx.__userVars__ = new Set();
        }
        // Set up utilities (but don't add mainDocument/mainWindow - we ARE main)
        this.setupUtilities();
        // Set up console interception (careful - this affects the real console)
        this.setupConsoleInterception();
    }
    /**
     * Initialize using an iframe
     */
    initializeIframe() {
        if (this.iframe) {
            this.destroy();
        }
        // Create iframe
        this.iframe = document.createElement('iframe');
        this.iframe.sandbox.add('allow-scripts');
        this.iframe.sandbox.add('allow-same-origin');
        // Handle visible vs hidden iframe
        if (this.options.targetElement) {
            // Visible artifact mode - render into target element
            const styles = this.options.iframeStyles || {};
            this.iframe.style.width = styles.width || '100%';
            this.iframe.style.height = styles.height || '100%';
            this.iframe.style.border = styles.border || 'none';
            this.iframe.style.display = 'block';
            // Apply any additional styles
            for (const [key, value] of Object.entries(styles)) {
                if (value && typeof value === 'string') {
                    this.iframe.style.setProperty(key, value);
                }
            }
            this.options.targetElement.appendChild(this.iframe);
        }
        else {
            // Hidden mode
            this.iframe.style.display = 'none';
            document.body.appendChild(this.iframe);
        }
        // Get the iframe's window
        this.ctx = this.iframe.contentWindow;
        // Initialize output queues
        this.ctx.__outputQueue__ = [];
        this.ctx.__displayQueue__ = [];
        this.ctx.__userVars__ = new Set();
        // Set up utilities
        this.setupUtilities();
        // Set up console interception
        this.setupConsoleInterception();
        // For visible iframes, set up a basic HTML structure
        if (this.options.targetElement && this.iframe.contentDocument) {
            this.iframe.contentDocument.body.style.margin = '0';
            this.iframe.contentDocument.body.style.padding = '0';
            this.iframe.contentDocument.body.style.fontFamily = 'system-ui, sans-serif';
        }
    }
    /**
     * Set up utility functions in the sandbox
     */
    setupUtilities() {
        if (!this.ctx)
            return;
        // Access to main document (if allowed and not already main context)
        if (this.options.allowMainDocumentAccess !== false && !this.useMainContext) {
            this.ctx.mainDocument = document;
            this.ctx.mainWindow = window;
        }
        // Sleep helper for async operations
        this.ctx.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        // Print helper (alias for console.log)
        this.ctx.print = (...args) => {
            this.ctx?.console.log(...args);
        };
        // Display helper for rich output
        this.ctx.display = (data, mimeType = 'text/plain') => {
            let content;
            if (typeof data === 'string') {
                content = data;
            }
            else if (data instanceof HTMLElement) {
                content = data.outerHTML;
                mimeType = 'text/html';
            }
            else {
                try {
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                }
                catch {
                    content = String(data);
                }
            }
            this.ctx?.__displayQueue__.push({ mimeType, data: content });
        };
        // Inject custom utilities
        if (this.options.utilities) {
            for (const [key, value] of Object.entries(this.options.utilities)) {
                this.ctx[key] = value;
            }
        }
    }
    /**
     * Set up console interception to capture output
     */
    setupConsoleInterception() {
        if (!this.ctx)
            return;
        const originalLog = this.ctx.console.log.bind(this.ctx.console);
        const originalError = this.ctx.console.error.bind(this.ctx.console);
        const originalWarn = this.ctx.console.warn.bind(this.ctx.console);
        const originalInfo = this.ctx.console.info.bind(this.ctx.console);
        // Save originals for restoration (important for main context)
        this.originalConsole = {
            log: originalLog,
            error: originalError,
            warn: originalWarn,
            info: originalInfo,
        };
        const formatArgs = (args) => {
            return args
                .map((arg) => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    }
                    catch {
                        return String(arg);
                    }
                }
                return String(arg);
            })
                .join(' ');
        };
        this.ctx.console.log = (...args) => {
            this.ctx?.__outputQueue__.push({
                type: 'log',
                content: formatArgs(args),
                timestamp: Date.now(),
            });
            this.options.onConsoleLog?.(...args);
            originalLog(...args);
        };
        this.ctx.console.error = (...args) => {
            this.ctx?.__outputQueue__.push({
                type: 'error',
                content: formatArgs(args),
                timestamp: Date.now(),
            });
            this.options.onConsoleError?.(...args);
            originalError(...args);
        };
        this.ctx.console.warn = (...args) => {
            this.ctx?.__outputQueue__.push({
                type: 'warn',
                content: formatArgs(args),
                timestamp: Date.now(),
            });
            this.options.onConsoleWarn?.(...args);
            originalWarn(...args);
        };
        this.ctx.console.info = (...args) => {
            this.ctx?.__outputQueue__.push({
                type: 'info',
                content: formatArgs(args),
                timestamp: Date.now(),
            });
            originalInfo(...args);
        };
    }
    /**
     * Restore original console methods (for main context cleanup)
     */
    restoreConsole() {
        if (!this.ctx || !this.originalConsole)
            return;
        if (this.originalConsole.log) {
            this.ctx.console.log = this.originalConsole.log;
        }
        if (this.originalConsole.error) {
            this.ctx.console.error = this.originalConsole.error;
        }
        if (this.originalConsole.warn) {
            this.ctx.console.warn = this.originalConsole.warn;
        }
        if (this.originalConsole.info) {
            this.ctx.console.info = this.originalConsole.info;
        }
        this.originalConsole = null;
    }
    /**
     * Execute code in the sandbox
     */
    async execute(code) {
        if (!this.ctx) {
            this.initialize();
        }
        // Clear output queues
        this.ctx.__outputQueue__ = [];
        this.ctx.__displayQueue__ = [];
        // Track variables that will be declared
        const declaredVars = extractDeclaredVariables(code);
        for (const v of declaredVars) {
            this.ctx.__userVars__.add(v);
        }
        // Transform code for persistence and async support
        const transformedCode = transformForPersistence(code);
        const wrappedCode = wrapForAsync(transformedCode);
        const startTime = performance.now();
        try {
            // Execute in iframe context
            const result = await this.ctx.eval(wrappedCode);
            const duration = performance.now() - startTime;
            // Collect outputs
            const outputs = this.ctx.__outputQueue__;
            const stdout = outputs
                .filter((o) => o.type === 'log' || o.type === 'info')
                .map((o) => o.content)
                .join('\n');
            const stderr = outputs
                .filter((o) => o.type === 'error' || o.type === 'warn')
                .map((o) => (o.type === 'error' ? `Error: ${o.content}` : `Warning: ${o.content}`))
                .join('\n');
            return {
                success: true,
                stdout,
                stderr,
                result,
                resultString: this.formatResult(result),
                duration,
                displayData: [...this.ctx.__displayQueue__],
            };
        }
        catch (error) {
            const duration = performance.now() - startTime;
            const execError = this.formatError(error);
            // Collect any output that happened before error
            const outputs = this.ctx.__outputQueue__;
            const stdout = outputs
                .filter((o) => o.type === 'log' || o.type === 'info')
                .map((o) => o.content)
                .join('\n');
            return {
                success: false,
                stdout,
                stderr: `${execError.name}: ${execError.message}`,
                error: execError,
                duration,
                displayData: [],
            };
        }
    }
    /**
     * Format the return value for display
     */
    formatResult(result) {
        if (result === undefined) {
            return undefined;
        }
        if (result === null) {
            return 'null';
        }
        if (typeof result === 'function') {
            return `[Function: ${result.name || 'anonymous'}]`;
        }
        if (typeof result === 'object') {
            try {
                return JSON.stringify(result, null, 2);
            }
            catch {
                return String(result);
            }
        }
        return String(result);
    }
    /**
     * Format an error for the result
     */
    formatError(error) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack?.split('\n'),
            };
        }
        return {
            name: 'Error',
            message: String(error),
        };
    }
    /**
     * Get all user-defined variables in the sandbox
     */
    getVariables() {
        if (!this.ctx)
            return {};
        const vars = {};
        // Only return variables we explicitly tracked as user-defined
        for (const key of this.ctx.__userVars__) {
            try {
                const value = this.ctx[key];
                vars[key] = value;
            }
            catch {
                // Skip inaccessible properties
            }
        }
        return vars;
    }
    /**
     * Get a specific variable's value
     */
    getVariable(name) {
        if (!this.ctx)
            return undefined;
        return this.ctx[name];
    }
    /**
     * Check if a variable exists in the sandbox
     */
    hasVariable(name) {
        if (!this.ctx)
            return false;
        return name in this.ctx;
    }
    /**
     * Get the execution context (for advanced use)
     */
    getContext() {
        return this.ctx;
    }
    /**
     * Reset the sandbox (clear all variables)
     */
    reset() {
        if (this.useMainContext) {
            // For main context, we can't recreate - just clear tracked variables
            if (this.ctx) {
                // Delete user-defined variables from window
                for (const key of this.ctx.__userVars__) {
                    try {
                        delete this.ctx[key];
                    }
                    catch {
                        // Some properties can't be deleted
                    }
                }
                this.ctx.__userVars__.clear();
                this.ctx.__outputQueue__ = [];
                this.ctx.__displayQueue__ = [];
            }
        }
        else {
            this.destroy();
            this.initialize();
        }
    }
    /**
     * Destroy the sandbox (remove iframe)
     */
    destroy() {
        // Restore console if we intercepted it
        this.restoreConsole();
        if (this.useMainContext) {
            // For main context, clean up our additions
            if (this.ctx) {
                // Clear user variables
                for (const key of this.ctx.__userVars__ || []) {
                    try {
                        delete this.ctx[key];
                    }
                    catch {
                        // Some properties can't be deleted
                    }
                }
                // Remove our internal properties
                delete this.ctx.__outputQueue__;
                delete this.ctx.__displayQueue__;
                delete this.ctx.__userVars__;
                delete this.ctx.sleep;
                delete this.ctx.display;
                delete this.ctx.print;
            }
            this.ctx = null;
        }
        else if (this.iframe) {
            // For iframe, remove from DOM
            const parent = this.iframe.parentElement;
            if (parent) {
                parent.removeChild(this.iframe);
            }
            this.iframe = null;
            this.ctx = null;
        }
    }
}

/**
 * Runtime-based Completion Provider
 *
 * Provides autocompletion by inspecting the live JavaScript runtime scope.
 * Unlike static LSP, this sees actual variable values and their types.
 */
/**
 * JavaScript keywords for completion
 */
const JS_KEYWORDS = [
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
    'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
    'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
];
/**
 * Common global functions/objects to suggest
 */
const COMMON_GLOBALS = [
    { label: 'console', type: 'variable', detail: 'Console' },
    { label: 'fetch', type: 'function', detail: '(url, options?) => Promise<Response>' },
    { label: 'setTimeout', type: 'function', detail: '(fn, ms) => number' },
    { label: 'setInterval', type: 'function', detail: '(fn, ms) => number' },
    { label: 'clearTimeout', type: 'function', detail: '(id) => void' },
    { label: 'clearInterval', type: 'function', detail: '(id) => void' },
    { label: 'JSON', type: 'variable', detail: 'JSON' },
    { label: 'Math', type: 'variable', detail: 'Math' },
    { label: 'Array', type: 'class', detail: 'Array constructor' },
    { label: 'Object', type: 'class', detail: 'Object constructor' },
    { label: 'Promise', type: 'class', detail: 'Promise constructor' },
    { label: 'Map', type: 'class', detail: 'Map constructor' },
    { label: 'Set', type: 'class', detail: 'Set constructor' },
    { label: 'Date', type: 'class', detail: 'Date constructor' },
    { label: 'RegExp', type: 'class', detail: 'RegExp constructor' },
];
/**
 * Get the completion type based on a value
 */
function getCompletionType(value) {
    if (typeof value === 'function') {
        if (/^class\s/.test(value.toString())) {
            return 'class';
        }
        return 'function';
    }
    if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
            return 'variable';
        }
        return 'variable';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return 'constant';
    }
    return 'variable';
}
/**
 * Get a short type description for a value
 */
function getTypeDescription(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const type = typeof value;
    if (type === 'function') {
        const fn = value;
        const name = fn.name || 'anonymous';
        const source = fn.toString();
        // Check if it's a class
        if (/^class\s/.test(source)) {
            return `class ${name}`;
        }
        // Try to extract parameter list
        const paramMatch = source.match(/^(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/);
        const params = paramMatch ? paramMatch[1].trim() : '...';
        return `(${params}) => ...`;
    }
    if (type === 'object') {
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        const constructor = value.constructor?.name;
        if (constructor && constructor !== 'Object') {
            return constructor;
        }
        const keys = Object.keys(value);
        if (keys.length <= 3) {
            return `{ ${keys.join(', ')} }`;
        }
        return `{ ${keys.slice(0, 3).join(', ')}, ... }`;
    }
    if (type === 'string') {
        const str = value;
        if (str.length > 30) {
            return `"${str.slice(0, 27)}..."`;
        }
        return `"${str}"`;
    }
    if (type === 'number' || type === 'boolean') {
        return String(value);
    }
    return type;
}
/**
 * Parse the completion context from code and cursor position
 */
function parseCompletionContext(code, cursorPos) {
    // Get the text before cursor
    const beforeCursor = code.slice(0, cursorPos);
    // Find the current word being typed
    const wordMatch = beforeCursor.match(/([a-zA-Z_$][\w$]*)$/);
    const word = wordMatch ? wordMatch[1] : '';
    const wordStart = cursorPos - word.length;
    // Check for property access: something.word
    const propertyMatch = beforeCursor.match(/([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.\s*([a-zA-Z_$][\w$]*)?$/);
    if (propertyMatch) {
        return {
            word: propertyMatch[2] || '',
            wordStart: cursorPos - (propertyMatch[2]?.length || 0),
            object: propertyMatch[1],
            isPropertyAccess: true,
            isMethodAccess: false,
        };
    }
    // Check for method chain after ().: something().word
    const methodChainMatch = beforeCursor.match(/\)\.\s*([a-zA-Z_$][\w$]*)?$/);
    if (methodChainMatch) {
        return {
            word: methodChainMatch[1] || '',
            wordStart: cursorPos - (methodChainMatch[1]?.length || 0),
            isPropertyAccess: true,
            isMethodAccess: true,
        };
    }
    return {
        word,
        wordStart,
        isPropertyAccess: false,
        isMethodAccess: false,
    };
}
/**
 * Get completions from the runtime scope
 */
function getCompletions(code, cursorPos, ctx, userVars) {
    const context = parseCompletionContext(code, cursorPos);
    const items = [];
    if (context.isPropertyAccess && context.object && ctx) {
        // Property completion: object.xxx
        try {
            // Evaluate the object to get its value
            const objValue = ctx.eval(context.object);
            if (objValue !== null && objValue !== undefined) {
                // Get own properties
                const ownProps = Object.getOwnPropertyNames(objValue);
                for (const prop of ownProps) {
                    if (prop.startsWith(context.word)) {
                        try {
                            const value = objValue[prop];
                            items.push({
                                label: prop,
                                type: typeof value === 'function' ? 'method' : 'property',
                                detail: getTypeDescription(value),
                            });
                        }
                        catch {
                            items.push({
                                label: prop,
                                type: 'property',
                            });
                        }
                    }
                }
                // Get prototype methods
                const proto = Object.getPrototypeOf(objValue);
                if (proto) {
                    const protoProps = Object.getOwnPropertyNames(proto);
                    for (const prop of protoProps) {
                        if (prop.startsWith(context.word) &&
                            prop !== 'constructor' &&
                            !items.some((i) => i.label === prop)) {
                            try {
                                const value = proto[prop];
                                if (typeof value === 'function') {
                                    items.push({
                                        label: prop,
                                        type: 'method',
                                        detail: getTypeDescription(value),
                                    });
                                }
                            }
                            catch {
                                // Skip
                            }
                        }
                    }
                }
            }
        }
        catch {
            // Object evaluation failed, can't provide completions
        }
    }
    else if (context.isMethodAccess) {
        // After ()., suggest common return type methods
        // This is harder without type info - suggest array methods as common case
        const arrayMethods = ['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'slice', 'concat', 'join'];
        for (const method of arrayMethods) {
            if (method.startsWith(context.word)) {
                items.push({
                    label: method,
                    type: 'method',
                    detail: 'Array method',
                });
            }
        }
    }
    else {
        // Top-level completion
        const word = context.word.toLowerCase();
        // Add user-defined variables first (highest priority)
        for (const [name, value] of Object.entries(userVars)) {
            if (name.toLowerCase().startsWith(word)) {
                items.push({
                    label: name,
                    type: getCompletionType(value),
                    detail: getTypeDescription(value),
                });
            }
        }
        // Add common globals
        for (const global of COMMON_GLOBALS) {
            if (global.label.toLowerCase().startsWith(word)) {
                if (!items.some((i) => i.label === global.label)) {
                    items.push(global);
                }
            }
        }
        // Add keywords
        for (const keyword of JS_KEYWORDS) {
            if (keyword.startsWith(word)) {
                items.push({
                    label: keyword,
                    type: 'keyword',
                });
            }
        }
    }
    // Sort: user vars first, then by label
    items.sort((a, b) => {
        // User-defined variables first
        const aIsUser = a.label in userVars;
        const bIsUser = b.label in userVars;
        if (aIsUser && !bIsUser)
            return -1;
        if (!aIsUser && bIsUser)
            return 1;
        // Then alphabetically
        return a.label.localeCompare(b.label);
    });
    return {
        items: items.slice(0, 50), // Limit results
        from: context.wordStart,
        to: cursorPos,
    };
}

/**
 * Runtime-based Hover Provider
 *
 * Provides hover information by inspecting actual runtime values.
 * Shows real values, types, and function signatures.
 */
/**
 * Maximum length for value previews
 */
const MAX_VALUE_LENGTH = 500;
const MAX_ARRAY_PREVIEW = 10;
const MAX_OBJECT_KEYS = 10;
/**
 * Parse an identifier from code at a given position
 */
function parseIdentifierAtPosition(code, cursorPos) {
    // Expand selection to find the full identifier/property chain
    let start = cursorPos;
    let end = cursorPos;
    // Find start of identifier
    while (start > 0) {
        const char = code[start - 1];
        if (/[\w$.]/.test(char)) {
            start--;
        }
        else {
            break;
        }
    }
    // Find end of identifier
    while (end < code.length) {
        const char = code[end];
        if (/[\w$]/.test(char)) {
            end++;
        }
        else {
            break;
        }
    }
    // Clean up leading dots
    while (code[start] === '.' && start < end) {
        start++;
    }
    const name = code.slice(start, end);
    if (!name || !/^[a-zA-Z_$][\w$.]*$/.test(name)) {
        return null;
    }
    return { name, start, end };
}
/**
 * Get type information for a value
 */
function getTypeInfo(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const type = typeof value;
    if (type === 'function') {
        const fn = value;
        const source = fn.toString();
        // Check if it's a class
        if (/^class\s/.test(source)) {
            return `class ${fn.name || 'anonymous'}`;
        }
        // Check if it's an async function
        if (/^async\s/.test(source)) {
            return `async function ${fn.name || 'anonymous'}`;
        }
        return `function ${fn.name || 'anonymous'}`;
    }
    if (type === 'object') {
        if (Array.isArray(value)) {
            const itemType = value.length > 0 ? typeof value[0] : 'unknown';
            return `Array<${itemType}> (length: ${value.length})`;
        }
        const constructor = value.constructor?.name;
        if (constructor && constructor !== 'Object') {
            return constructor;
        }
        return 'object';
    }
    return type;
}
/**
 * Get a function's signature
 */
function getFunctionSignature(fn) {
    const source = fn.toString();
    // Extract parameters
    const paramMatch = source.match(/^(?:async\s+)?(?:function\s*)?(?:\w*\s*)?\(([^)]*)\)/);
    const params = paramMatch ? paramMatch[1].trim() : '';
    // Detect arrow function
    const isArrow = /^(?:async\s+)?\([^)]*\)\s*=>/.test(source) ||
        /^(?:async\s+)?[a-zA-Z_$][\w$]*\s*=>/.test(source);
    // Detect class
    if (/^class\s/.test(source)) {
        // Try to find constructor
        const ctorMatch = source.match(/constructor\s*\(([^)]*)\)/);
        const ctorParams = ctorMatch ? ctorMatch[1].trim() : '';
        return `class ${fn.name || 'anonymous'}${ctorParams ? `(${ctorParams})` : ''}`;
    }
    const asyncPrefix = /^async\s/.test(source) ? 'async ' : '';
    if (isArrow) {
        return `${asyncPrefix}(${params}) => ...`;
    }
    return `${asyncPrefix}function ${fn.name || 'anonymous'}(${params})`;
}
/**
 * Format a value for preview
 */
function formatValuePreview(value, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) {
        return '...';
    }
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const type = typeof value;
    if (type === 'string') {
        const str = value;
        if (str.length > 100) {
            return `"${str.slice(0, 97)}..."`;
        }
        return `"${str}"`;
    }
    if (type === 'number' || type === 'boolean' || type === 'bigint') {
        return String(value);
    }
    if (type === 'symbol') {
        return value.toString();
    }
    if (type === 'function') {
        return getFunctionSignature(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            return '[]';
        if (depth >= maxDepth)
            return `Array(${value.length})`;
        const preview = value
            .slice(0, MAX_ARRAY_PREVIEW)
            .map((v) => formatValuePreview(v, depth + 1, maxDepth))
            .join(', ');
        const suffix = value.length > MAX_ARRAY_PREVIEW ? ', ...' : '';
        return `[${preview}${suffix}]`;
    }
    if (type === 'object') {
        const obj = value;
        const constructor = obj.constructor?.name;
        // Special handling for common types
        if (constructor === 'Date') {
            return value.toISOString();
        }
        if (constructor === 'RegExp') {
            return value.toString();
        }
        if (constructor === 'Map') {
            const map = value;
            return `Map(${map.size})`;
        }
        if (constructor === 'Set') {
            const set = value;
            return `Set(${set.size})`;
        }
        if (constructor === 'Error') {
            const err = value;
            return `${err.name}: ${err.message}`;
        }
        const keys = Object.keys(obj);
        if (keys.length === 0)
            return '{}';
        if (depth >= maxDepth)
            return `{...}`;
        const preview = keys
            .slice(0, MAX_OBJECT_KEYS)
            .map((key) => {
            const val = formatValuePreview(obj[key], depth + 1, maxDepth);
            return `${key}: ${val}`;
        })
            .join(', ');
        const suffix = keys.length > MAX_OBJECT_KEYS ? ', ...' : '';
        const prefix = constructor && constructor !== 'Object' ? `${constructor} ` : '';
        return `${prefix}{ ${preview}${suffix} }`;
    }
    return String(value);
}
/**
 * Get hover information for an identifier
 */
function getHoverInfo(code, cursorPos, ctx) {
    const identifier = parseIdentifierAtPosition(code, cursorPos);
    if (!identifier || !ctx) {
        return { found: false, name: '', type: '' };
    }
    try {
        // Evaluate the identifier to get its value
        const value = ctx.eval(identifier.name);
        const type = getTypeInfo(value);
        const preview = formatValuePreview(value);
        const result = {
            found: true,
            name: identifier.name,
            type,
        };
        // Add value preview (truncate if too long)
        if (preview.length <= MAX_VALUE_LENGTH) {
            result.value = preview;
        }
        else {
            result.value = preview.slice(0, MAX_VALUE_LENGTH - 3) + '...';
        }
        // Add signature for functions
        if (typeof value === 'function') {
            result.signature = getFunctionSignature(value);
        }
        return result;
    }
    catch (error) {
        // Variable doesn't exist or can't be evaluated
        return {
            found: false,
            name: identifier.name,
            type: '',
        };
    }
}
/**
 * Get detailed inspection of a specific object path
 * Used for drill-down in variable explorer
 */
function inspectObjectPath(path, ctx) {
    if (!ctx)
        return null;
    try {
        const value = ctx.eval(path);
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value !== 'object' && typeof value !== 'function') {
            return { __value__: value };
        }
        const result = {};
        // Get own properties
        const ownProps = Object.getOwnPropertyNames(value);
        for (const prop of ownProps) {
            if (prop !== '__proto__') {
                try {
                    const propValue = value[prop];
                    result[prop] = {
                        type: getTypeInfo(propValue),
                        value: formatValuePreview(propValue, 0, 1),
                        expandable: propValue !== null &&
                            propValue !== undefined &&
                            (typeof propValue === 'object' || typeof propValue === 'function'),
                    };
                }
                catch {
                    result[prop] = { type: 'unknown', value: '[inaccessible]' };
                }
            }
        }
        return result;
    }
    catch {
        return null;
    }
}

/**
 * Runtime Variable Explorer
 *
 * Lists and inspects variables in the JavaScript runtime scope.
 * Like RStudio's Environment pane or Jupyter's Variable Inspector.
 */
/**
 * Maximum length for value preview in variable list
 */
const MAX_PREVIEW_LENGTH = 100;
/**
 * Get the size/length info for a value
 */
function getSizeInfo(value) {
    if (Array.isArray(value)) {
        return `${value.length} items`;
    }
    if (value instanceof Map) {
        return `${value.size} entries`;
    }
    if (value instanceof Set) {
        return `${value.size} items`;
    }
    if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);
        return `${keys.length} keys`;
    }
    if (typeof value === 'string') {
        return `${value.length} chars`;
    }
    return undefined;
}
/**
 * Get a type string for a value
 */
function getTypeString(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const type = typeof value;
    if (type === 'function') {
        const fn = value;
        const source = fn.toString();
        if (/^class\s/.test(source)) {
            return 'class';
        }
        if (/^async\s/.test(source)) {
            return 'async function';
        }
        return 'function';
    }
    if (type === 'object') {
        if (Array.isArray(value)) {
            return 'array';
        }
        const constructor = value.constructor?.name;
        if (constructor && constructor !== 'Object') {
            return constructor.toLowerCase();
        }
        return 'object';
    }
    return type;
}
/**
 * Get a preview string for a value
 */
function getValuePreview(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    const type = typeof value;
    if (type === 'string') {
        const str = value;
        if (str.length > MAX_PREVIEW_LENGTH - 2) {
            return `"${str.slice(0, MAX_PREVIEW_LENGTH - 5)}..."`;
        }
        return `"${str}"`;
    }
    if (type === 'number' || type === 'boolean' || type === 'bigint') {
        return String(value);
    }
    if (type === 'symbol') {
        return value.toString();
    }
    if (type === 'function') {
        const fn = value;
        const source = fn.toString();
        if (/^class\s/.test(source)) {
            return `class ${fn.name || 'anonymous'}`;
        }
        const paramMatch = source.match(/^(?:async\s+)?(?:function\s*)?(?:\w*\s*)?\(([^)]*)\)/);
        const params = paramMatch ? paramMatch[1].trim() : '';
        const asyncPrefix = /^async\s/.test(source) ? 'async ' : '';
        if (fn.name) {
            return `${asyncPrefix}ƒ ${fn.name}(${params})`;
        }
        return `${asyncPrefix}ƒ (${params})`;
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            return '[]';
        if (value.length <= 3) {
            const items = value.map((v) => {
                if (typeof v === 'string')
                    return `"${v.slice(0, 20)}"`;
                if (typeof v === 'object')
                    return '{...}';
                return String(v).slice(0, 20);
            });
            return `[${items.join(', ')}]`;
        }
        return `[${value.length} items]`;
    }
    if (type === 'object') {
        const obj = value;
        const constructor = obj.constructor?.name;
        // Special cases
        if (constructor === 'Date') {
            return value.toISOString();
        }
        if (constructor === 'RegExp') {
            return value.toString();
        }
        if (constructor === 'Map') {
            return `Map(${value.size})`;
        }
        if (constructor === 'Set') {
            return `Set(${value.size})`;
        }
        if (constructor === 'Error') {
            const err = value;
            return `${err.name}: ${err.message}`;
        }
        const keys = Object.keys(obj);
        if (keys.length === 0)
            return '{}';
        if (keys.length <= 3) {
            const preview = keys.map((k) => `${k}: ...`).join(', ');
            return `{${preview}}`;
        }
        const prefix = constructor && constructor !== 'Object' ? constructor + ' ' : '';
        return `${prefix}{${keys.length} keys}`;
    }
    return String(value).slice(0, MAX_PREVIEW_LENGTH);
}
/**
 * Check if a value is expandable (has children to explore)
 */
function isExpandable(value) {
    if (value === null || value === undefined)
        return false;
    const type = typeof value;
    if (type === 'object') {
        return true;
    }
    if (type === 'function') {
        // Functions have properties but usually not interesting to expand
        return false;
    }
    return false;
}
/**
 * Get information about all variables in scope
 */
function getVariables(userVars) {
    const variables = [];
    for (const [name, value] of Object.entries(userVars)) {
        variables.push({
            name,
            type: getTypeString(value),
            value: getValuePreview(value),
            size: getSizeInfo(value),
            expandable: isExpandable(value),
        });
    }
    // Sort alphabetically
    variables.sort((a, b) => a.name.localeCompare(b.name));
    return variables;
}
/**
 * Get detailed information about a specific variable
 */
function getVariableDetail(name, ctx) {
    if (!ctx)
        return null;
    try {
        const value = ctx.eval(name);
        return {
            name,
            type: getTypeString(value),
            value: getValuePreview(value),
            size: getSizeInfo(value),
            expandable: isExpandable(value),
        };
    }
    catch {
        return null;
    }
}
/**
 * Expand a variable to see its children (properties/elements)
 */
function expandVariable(path, ctx) {
    if (!ctx)
        return null;
    try {
        const value = ctx.eval(path);
        if (value === null || value === undefined) {
            return null;
        }
        const children = [];
        if (Array.isArray(value)) {
            // For arrays, show indices
            const maxShow = Math.min(value.length, 100);
            for (let i = 0; i < maxShow; i++) {
                const item = value[i];
                children.push({
                    name: `[${i}]`,
                    type: getTypeString(item),
                    value: getValuePreview(item),
                    size: getSizeInfo(item),
                    expandable: isExpandable(item),
                });
            }
            if (value.length > maxShow) {
                children.push({
                    name: '...',
                    type: 'more',
                    value: `${value.length - maxShow} more items`,
                    expandable: false,
                });
            }
        }
        else if (typeof value === 'object') {
            // For objects, show properties
            const keys = Object.keys(value);
            const maxShow = Math.min(keys.length, 100);
            for (let i = 0; i < maxShow; i++) {
                const key = keys[i];
                const propValue = value[key];
                children.push({
                    name: key,
                    type: getTypeString(propValue),
                    value: getValuePreview(propValue),
                    size: getSizeInfo(propValue),
                    expandable: isExpandable(propValue),
                });
            }
            if (keys.length > maxShow) {
                children.push({
                    name: '...',
                    type: 'more',
                    value: `${keys.length - maxShow} more properties`,
                    expandable: false,
                });
            }
        }
        return children;
    }
    catch {
        return null;
    }
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
class JavaScriptClient {
    constructor(options = {}) {
        this.initialized = false;
        this.sandbox = new IframeSandbox(options.sandbox);
    }
    /**
     * Ensure the sandbox is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            this.sandbox.initialize();
            this.initialized = true;
        }
    }
    /**
     * Get the sandbox execution context
     */
    getContext() {
        this.ensureInitialized();
        return this.sandbox.getContext();
    }
    // ===========================================================================
    // Execution
    // ===========================================================================
    /**
     * Execute JavaScript code
     *
     * @param code - The code to execute
     * @returns Execution result with output, return value, and timing
     */
    async execute(code) {
        this.ensureInitialized();
        return this.sandbox.execute(code);
    }
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
    async executeStreaming(code, onChunk) {
        this.ensureInitialized();
        // For now, we don't have true streaming from the iframe
        // We execute and then stream the result
        // TODO: Implement actual streaming with periodic output polling
        const result = await this.sandbox.execute(code);
        // Stream stdout
        if (result.stdout) {
            const lines = result.stdout.split('\n');
            let accumulated = '';
            for (const line of lines) {
                accumulated += line + '\n';
                onChunk(line + '\n', accumulated, false);
            }
        }
        // Stream stderr
        if (result.stderr) {
            const lines = result.stderr.split('\n');
            let accumulated = result.stdout || '';
            for (const line of lines) {
                accumulated += line + '\n';
                onChunk(line + '\n', accumulated, false);
            }
        }
        // Final chunk with result
        let finalAccumulated = (result.stdout || '') + (result.stderr || '');
        if (result.resultString) {
            const resultLine = `→ ${result.resultString}\n`;
            finalAccumulated += resultLine;
            onChunk(resultLine, finalAccumulated, false);
        }
        // Done
        onChunk('', finalAccumulated, true);
        return result;
    }
    // ===========================================================================
    // LSP-like Features
    // ===========================================================================
    /**
     * Get completions at cursor position
     *
     * @param code - The code being edited
     * @param cursorPos - Cursor position (0-indexed character offset)
     * @returns Completion items with position info
     */
    complete(code, cursorPos) {
        const ctx = this.getContext();
        const userVars = this.sandbox.getVariables();
        return getCompletions(code, cursorPos, ctx, userVars);
    }
    /**
     * Get hover information at cursor position
     *
     * @param code - The code being edited
     * @param cursorPos - Cursor position
     * @returns Hover info with type, value preview, and signature
     */
    hover(code, cursorPos) {
        const ctx = this.getContext();
        return getHoverInfo(code, cursorPos, ctx);
    }
    /**
     * Inspect an object by path
     *
     * @param path - Object path (e.g., "obj.prop" or "arr[0]")
     * @returns Object properties with type and value info
     */
    inspect(path) {
        const ctx = this.getContext();
        return inspectObjectPath(path, ctx);
    }
    /**
     * Get all variables in scope
     *
     * @returns Array of variable information
     */
    variables() {
        this.ensureInitialized();
        const userVars = this.sandbox.getVariables();
        return getVariables(userVars);
    }
    /**
     * Expand a variable to see its children
     *
     * @param path - Variable path to expand
     * @returns Array of child variable info, or null if not expandable
     */
    expandVariable(path) {
        const ctx = this.getContext();
        return expandVariable(path, ctx);
    }
    // ===========================================================================
    // Scope Management
    // ===========================================================================
    /**
     * Get all user-defined variables and their values
     *
     * @returns Object mapping variable names to values
     */
    getScope() {
        this.ensureInitialized();
        return this.sandbox.getVariables();
    }
    /**
     * Get a specific variable's value
     *
     * @param name - Variable name
     * @returns Variable value, or undefined if not found
     */
    getVariable(name) {
        this.ensureInitialized();
        return this.sandbox.getVariable(name);
    }
    /**
     * Check if a variable exists in scope
     *
     * @param name - Variable name
     * @returns Whether the variable exists
     */
    hasVariable(name) {
        this.ensureInitialized();
        return this.sandbox.hasVariable(name);
    }
    /**
     * Check if this client is using the main window context
     */
    isMainContext() {
        return this.sandbox.isMainContext();
    }
    /**
     * Get the iframe element (null if using main context)
     */
    getIframe() {
        return this.sandbox.getIframe();
    }
    // ===========================================================================
    // Lifecycle
    // ===========================================================================
    /**
     * Reset the runtime (clear all variables)
     */
    reset() {
        if (this.initialized) {
            this.sandbox.reset();
        }
    }
    /**
     * Destroy the client and clean up resources
     */
    destroy() {
        if (this.initialized) {
            this.sandbox.destroy();
            this.initialized = false;
        }
    }
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
 * Supported language identifiers
 */
const SUPPORTED_LANGUAGES = ['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx'];
/**
 * JavaScript executor implementing the mrmd-editor Executor interface
 */
class JavaScriptExecutor {
    /**
     * Create a new JavaScript executor
     *
     * @param options - Client options
     */
    constructor(options = {}) {
        this.client = new JavaScriptClient(options);
    }
    /**
     * Get the underlying client for direct access to LSP features
     */
    getClient() {
        return this.client;
    }
    /**
     * Execute code and return result
     *
     * @param code - The code to execute
     * @param language - Language identifier (must be javascript/js/jsx)
     * @param execId - Optional execution ID for tracking
     * @returns Execution result
     */
    async execute(code, language, _execId) {
        if (!this.supports(language)) {
            return {
                success: false,
                stdout: '',
                stderr: `Language '${language}' is not supported by JavaScriptExecutor`,
                error: {
                    name: 'UnsupportedLanguageError',
                    message: `Expected one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
                },
            };
        }
        return this.client.execute(code);
    }
    /**
     * Execute code with streaming output
     *
     * @param code - The code to execute
     * @param language - Language identifier
     * @param onChunk - Callback for each output chunk
     * @param execId - Optional execution ID
     * @returns Final execution result
     */
    async executeStreaming(code, language, onChunk, _execId) {
        if (!this.supports(language)) {
            const error = `Language '${language}' is not supported by JavaScriptExecutor`;
            onChunk(error, error, true);
            return {
                success: false,
                stdout: '',
                stderr: error,
                error: {
                    name: 'UnsupportedLanguageError',
                    message: `Expected one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
                },
            };
        }
        return this.client.executeStreaming(code, onChunk);
    }
    /**
     * Check if executor supports a language
     *
     * @param language - Language identifier to check
     * @returns Whether the language is supported
     */
    supports(language) {
        return SUPPORTED_LANGUAGES.includes(language.toLowerCase());
    }
    /**
     * Clean up assets for a given execution ID
     *
     * JavaScript runtime doesn't create file assets, so this is a no-op.
     *
     * @param execId - Execution ID
     */
    async cleanupAssets(_execId) {
        // No-op for JavaScript - we don't create file assets
    }
    /**
     * Reset the runtime (clear all variables)
     */
    reset() {
        this.client.reset();
    }
    /**
     * Destroy the executor and clean up resources
     */
    destroy() {
        this.client.destroy();
    }
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
 * Multi-scope JavaScript runtime manager
 */
class JavaScriptRuntime {
    constructor(options = {}) {
        /** Named scopes (isolated iframes) */
        this.scopes = new Map();
        /** Default scope */
        this.defaultScope = null;
        /** Main context client (for executeInMain) */
        this.mainClient = null;
        this.defaultOptions = options;
    }
    // ===========================================================================
    // Default Scope (convenience methods)
    // ===========================================================================
    /**
     * Get or create the default scope
     */
    getDefaultScope() {
        if (!this.defaultScope) {
            this.defaultScope = new JavaScriptClient({ sandbox: this.defaultOptions });
        }
        return this.defaultScope;
    }
    /**
     * Execute code in the default scope
     */
    async execute(code) {
        return this.getDefaultScope().execute(code);
    }
    /**
     * Execute with streaming in the default scope
     */
    async executeStreaming(code, onChunk) {
        return this.getDefaultScope().executeStreaming(code, onChunk);
    }
    /**
     * Get completions in the default scope
     */
    complete(code, cursorPos) {
        return this.getDefaultScope().complete(code, cursorPos);
    }
    /**
     * Get hover info in the default scope
     */
    hover(code, cursorPos) {
        return this.getDefaultScope().hover(code, cursorPos);
    }
    /**
     * Get variables in the default scope
     */
    variables() {
        return this.getDefaultScope().variables();
    }
    /**
     * Reset the default scope
     */
    reset() {
        if (this.defaultScope) {
            this.defaultScope.reset();
        }
    }
    /**
     * Get completions for a specific scope
     */
    completeInScope(scopeName, code, cursorPos) {
        const client = this.scopes.get(scopeName);
        if (!client) {
            return { items: [], from: cursorPos, to: cursorPos };
        }
        return client.complete(code, cursorPos);
    }
    /**
     * Get hover info for a specific scope
     */
    hoverInScope(scopeName, code, cursorPos) {
        const client = this.scopes.get(scopeName);
        if (!client) {
            return { found: false, name: '', type: '' };
        }
        return client.hover(code, cursorPos);
    }
    /**
     * Get variables from a specific scope
     */
    variablesInScope(scopeName) {
        const client = this.scopes.get(scopeName);
        if (!client) {
            return [];
        }
        return client.variables();
    }
    /**
     * Get variables from ALL scopes (for cross-scope awareness)
     * Returns a map of scope name -> variables
     */
    allVariables() {
        const result = new Map();
        // Default scope
        if (this.defaultScope) {
            result.set('default', this.defaultScope.variables());
        }
        // Named scopes
        for (const [name, client] of this.scopes) {
            result.set(name, client.variables());
        }
        // Main context (if initialized)
        if (this.mainClient) {
            result.set('main', this.mainClient.variables());
        }
        return result;
    }
    // ===========================================================================
    // Named Scopes
    // ===========================================================================
    /**
     * Get or create a named scope
     *
     * Each scope is an isolated execution environment with its own variables.
     *
     * @param name - Unique name for the scope
     * @param options - Optional sandbox options for this scope
     * @returns JavaScriptClient for the scope
     */
    scope(name, options) {
        let client = this.scopes.get(name);
        if (!client) {
            client = new JavaScriptClient({
                sandbox: { ...this.defaultOptions, ...options },
            });
            this.scopes.set(name, client);
        }
        return client;
    }
    /**
     * Check if a named scope exists
     */
    hasScope(name) {
        return this.scopes.has(name);
    }
    /**
     * List all named scopes
     */
    listScopes() {
        return Array.from(this.scopes.keys());
    }
    /**
     * Destroy a named scope
     */
    destroyScope(name) {
        const client = this.scopes.get(name);
        if (client) {
            client.destroy();
            this.scopes.delete(name);
            return true;
        }
        return false;
    }
    /**
     * Reset a named scope (clear variables but keep the scope)
     */
    resetScope(name) {
        const client = this.scopes.get(name);
        if (client) {
            client.reset();
            return true;
        }
        return false;
    }
    // ===========================================================================
    // Main Context
    // ===========================================================================
    /**
     * Execute code in the main window context
     *
     * WARNING: This gives access to the page's variables and DOM.
     * Changes can affect the page's state.
     *
     * @param code - Code to execute
     * @returns Execution result
     */
    async executeInMain(code) {
        if (!this.mainClient) {
            this.mainClient = new JavaScriptClient({
                sandbox: {
                    ...this.defaultOptions,
                    useMainContext: true,
                },
            });
        }
        return this.mainClient.execute(code);
    }
    /**
     * Get the main context client (creates if needed)
     *
     * Use this for completions/hover in main context.
     */
    getMainClient() {
        if (!this.mainClient) {
            this.mainClient = new JavaScriptClient({
                sandbox: {
                    ...this.defaultOptions,
                    useMainContext: true,
                },
            });
        }
        return this.mainClient;
    }
    // ===========================================================================
    // Artifacts (Visible Iframes)
    // ===========================================================================
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
    createArtifact(name, targetElement, options = {}) {
        // Destroy existing artifact with same name
        this.destroyScope(name);
        const client = new JavaScriptClient({
            sandbox: {
                ...this.defaultOptions,
                ...options.sandbox,
                targetElement,
                iframeStyles: options.styles,
            },
        });
        this.scopes.set(name, client);
        return client;
    }
    /**
     * Get an existing artifact by name
     */
    getArtifact(name) {
        return this.scopes.get(name);
    }
    // ===========================================================================
    // Lifecycle
    // ===========================================================================
    /**
     * Destroy all scopes and clean up
     */
    destroy() {
        // Destroy default scope
        if (this.defaultScope) {
            this.defaultScope.destroy();
            this.defaultScope = null;
        }
        // Destroy main client
        if (this.mainClient) {
            this.mainClient.destroy();
            this.mainClient = null;
        }
        // Destroy all named scopes
        for (const client of this.scopes.values()) {
            client.destroy();
        }
        this.scopes.clear();
    }
    /**
     * Reset all scopes (clear variables but keep scopes)
     */
    resetAll() {
        if (this.defaultScope) {
            this.defaultScope.reset();
        }
        if (this.mainClient) {
            this.mainClient.reset();
        }
        for (const client of this.scopes.values()) {
            client.reset();
        }
    }
}

/**
 * Script Execution Manager
 *
 * Prevents re-execution of scripts when HTML widgets are recreated
 * (e.g., on viewport scroll in virtualized editors). Each execution ID
 * tracks which scripts have already run via content hashing.
 *
 * This is essential for:
 * - Preventing side effects from running twice
 * - Avoiding duplicate event listeners
 * - Maintaining correct state in interactive widgets
 */
/** Map of execId -> Set of script content hashes that have been executed */
const executedScripts = new Map();
/**
 * Simple hash function for script content
 * Uses djb2 algorithm - fast and good distribution for strings
 */
function hashContent(content) {
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
}
/**
 * Execute scripts for a cell, skipping any that have already run
 *
 * @param execId - Unique execution ID for this cell/render
 * @param scripts - Array of script contents to execute
 * @param context - The element or shadow root to use as `this` context
 * @param onError - Optional callback for script errors
 * @returns Number of scripts actually executed (not skipped)
 */
function executeScripts(execId, scripts, context, onError) {
    if (!executedScripts.has(execId)) {
        executedScripts.set(execId, new Set());
    }
    const executed = executedScripts.get(execId);
    let count = 0;
    for (const script of scripts) {
        const trimmed = script.trim();
        if (!trimmed)
            continue;
        const hash = hashContent(trimmed);
        if (executed.has(hash)) {
            // Already executed, skip
            continue;
        }
        executed.add(hash);
        try {
            // Create function and execute with context as `this`
            // This allows scripts to access the container via `this`
            const fn = new Function(trimmed);
            fn.call(context);
            count++;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (onError) {
                onError(err, trimmed);
            }
            else {
                console.error(`[ScriptManager ${execId}] Script error:`, err);
            }
        }
    }
    return count;
}
/**
 * Clear tracked scripts for a specific execution ID
 * Call this before re-executing a cell to allow scripts to run again
 *
 * @param execId - Execution ID to clear
 */
function clearScripts(execId) {
    executedScripts.delete(execId);
}
/**
 * Clear all tracked scripts across all execution IDs
 * Useful when resetting the entire runtime
 */
function clearAllScripts() {
    executedScripts.clear();
}
/**
 * Check if any scripts have been executed for an execution ID
 *
 * @param execId - Execution ID to check
 */
function hasExecutedScripts(execId) {
    const set = executedScripts.get(execId);
    return set !== undefined && set.size > 0;
}

/**
 * HTML Utilities
 *
 * Functions for extracting and processing HTML content:
 * - Extract <script> tags from HTML
 * - Extract <style> tags from HTML
 * - Scope CSS selectors with a prefix class
 */
/**
 * Regex to match script tags and capture their content
 * Handles: <script>, <script type="...">, <script src="...">
 * Captures the content between opening and closing tags
 */
const SCRIPT_REGEX = /<script[^>]*>([\s\S]*?)<\/script>/gi;
/**
 * Regex to match style tags and capture their content
 */
const STYLE_REGEX = /<style[^>]*>([\s\S]*?)<\/style>/gi;
/**
 * Extract script tags from HTML, returning cleaned HTML and script contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of script contents
 */
function extractScripts(html) {
    const scripts = [];
    const cleaned = html.replace(SCRIPT_REGEX, (_, content) => {
        if (content.trim()) {
            scripts.push(content);
        }
        return '';
    });
    return { html: cleaned, scripts };
}
/**
 * Extract style tags from HTML, returning cleaned HTML and style contents
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML and array of style contents
 */
function extractStyles(html) {
    const styles = [];
    const cleaned = html.replace(STYLE_REGEX, (_, content) => {
        if (content.trim()) {
            styles.push(content);
        }
        return '';
    });
    return { html: cleaned, styles };
}
/**
 * Extract both scripts and styles from HTML
 *
 * @param html - HTML string to process
 * @returns Object with cleaned HTML, scripts array, and styles array
 */
function extractScriptsAndStyles(html) {
    const scripts = [];
    const styles = [];
    let cleaned = html.replace(SCRIPT_REGEX, (_, content) => {
        if (content.trim()) {
            scripts.push(content);
        }
        return '';
    });
    cleaned = cleaned.replace(STYLE_REGEX, (_, content) => {
        if (content.trim()) {
            styles.push(content);
        }
        return '';
    });
    return { html: cleaned, scripts, styles };
}
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
function scopeStyles(css, scopeSelector) {
    // Match selector blocks (everything before a {)
    // This is a simplified implementation that handles most common cases
    return css.replace(/([^{}]+)\{/g, (_match, selectors) => {
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
                !trimmed) {
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
            // Prefix the selector
            return `${scopeSelector} ${trimmed}`;
        })
            .join(', ');
        return `${scoped} {`;
    });
}
/**
 * Generate a valid CSS class name from an execution ID
 *
 * @param execId - Execution ID (e.g., 'exec-1234567890-abc12')
 * @returns Valid CSS class name (e.g., 'mrmd-scope-exec1234567890abc12')
 */
function generateScopeClass(execId) {
    // Remove non-alphanumeric characters and prefix
    const sanitized = execId.replace(/[^a-z0-9]/gi, '');
    return `mrmd-scope-${sanitized}`;
}
/**
 * Create a style element with the given CSS content
 *
 * @param css - CSS content
 * @returns HTMLStyleElement
 */
function createStyleElement(css) {
    const style = document.createElement('style');
    style.textContent = css;
    return style;
}
/**
 * Parse HTML string into a DocumentFragment
 * This properly handles all HTML elements including scripts and styles
 *
 * @param html - HTML string to parse
 * @returns DocumentFragment containing the parsed nodes
 */
function parseHtml(html) {
    const range = document.createRange();
    return range.createContextualFragment(html);
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
class HtmlRenderer {
    /**
     * Render HTML into a container element
     *
     * @param html - HTML content to render
     * @param container - Target container element
     * @param options - Rendering options
     * @returns Render result with details about what was rendered
     */
    render(html, container, options = {}) {
        const { mode = 'direct', execId = `render-${Date.now()}`, executeScripts: shouldExecuteScripts = true, onScriptError, } = options;
        // Clear previous scripts if re-rendering with same execId
        if (options.execId) {
            clearScripts(execId);
        }
        const result = {
            container,
            scriptsExecuted: 0,
            scriptErrors: [],
        };
        // Handle empty content
        if (!html || !html.trim()) {
            container.textContent = '';
            return result;
        }
        // Route to appropriate rendering method
        switch (mode) {
            case 'shadow':
                return this.renderShadow(html, container, execId, shouldExecuteScripts, onScriptError);
            case 'scoped':
                const scopeClass = options.scopeClass || generateScopeClass(execId);
                return this.renderScoped(html, container, execId, scopeClass, shouldExecuteScripts, onScriptError);
            case 'direct':
            default:
                return this.renderDirect(html, container, execId, shouldExecuteScripts, onScriptError);
        }
    }
    /**
     * Render HTML directly into container (no isolation)
     */
    renderDirect(html, container, execId, shouldExecuteScripts, onScriptError) {
        const result = {
            container,
            scriptsExecuted: 0,
            scriptErrors: [],
        };
        const { html: cleanedHtml, scripts } = extractScripts(html);
        // Clear container and insert HTML
        container.innerHTML = '';
        const fragment = parseHtml(cleanedHtml);
        container.appendChild(fragment);
        // Execute scripts if enabled
        if (shouldExecuteScripts && scripts.length > 0) {
            const errorHandler = (error, script) => {
                result.scriptErrors.push(error);
                onScriptError?.(error, script);
            };
            result.scriptsExecuted = executeScripts(execId, scripts, container, errorHandler);
        }
        return result;
    }
    /**
     * Render HTML into Shadow DOM (full isolation)
     */
    renderShadow(html, container, execId, shouldExecuteScripts, onScriptError) {
        // Create or reuse shadow root
        let shadowRoot = container.shadowRoot;
        if (!shadowRoot) {
            shadowRoot = container.attachShadow({ mode: 'open' });
        }
        const result = {
            container,
            shadowRoot,
            scriptsExecuted: 0,
            scriptErrors: [],
        };
        const { html: cleanedHtml, scripts } = extractScripts(html);
        // Clear and set shadow content
        // Note: We use innerHTML here because shadow DOM handles styles correctly
        shadowRoot.innerHTML = cleanedHtml;
        // Execute scripts with shadow root as context
        if (shouldExecuteScripts && scripts.length > 0) {
            const errorHandler = (error, script) => {
                result.scriptErrors.push(error);
                onScriptError?.(error, script);
            };
            result.scriptsExecuted = executeScripts(execId, scripts, shadowRoot, errorHandler);
        }
        return result;
    }
    /**
     * Render HTML with scoped CSS (class-based isolation)
     */
    renderScoped(html, container, execId, scopeClass, shouldExecuteScripts, onScriptError) {
        const result = {
            container,
            scriptsExecuted: 0,
            scriptErrors: [],
        };
        // Add scope class to container
        container.classList.add(scopeClass);
        const { html: cleanedHtml, scripts, styles } = extractScriptsAndStyles(html);
        // Clear container
        container.innerHTML = '';
        // Scope and insert styles
        if (styles.length > 0) {
            const scopedCss = styles
                .map(style => scopeStyles(style, `.${scopeClass}`))
                .join('\n');
            const styleEl = createStyleElement(scopedCss);
            container.appendChild(styleEl);
        }
        // Insert HTML content
        const fragment = parseHtml(cleanedHtml);
        container.appendChild(fragment);
        // Execute scripts
        if (shouldExecuteScripts && scripts.length > 0) {
            const errorHandler = (error, script) => {
                result.scriptErrors.push(error);
                onScriptError?.(error, script);
            };
            result.scriptsExecuted = executeScripts(execId, scripts, container, errorHandler);
        }
        return result;
    }
    /**
     * Clear all tracked scripts for an execution ID
     * Call this before re-rendering to allow scripts to run again
     */
    clearScripts(execId) {
        clearScripts(execId);
    }
}
/**
 * Create a new HtmlRenderer instance
 */
function createHtmlRenderer() {
    return new HtmlRenderer();
}
/**
 * Convenience function to render HTML without creating a renderer instance
 */
function renderHtml(html, container, options) {
    const renderer = new HtmlRenderer();
    return renderer.render(html, container, options);
}

export { HtmlRenderer, IframeSandbox, JavaScriptClient, JavaScriptExecutor, JavaScriptRuntime, clearAllScripts, clearScripts, createHtmlRenderer, executeScripts, expandVariable, extractDeclaredVariables, extractScripts, extractScriptsAndStyles, extractStyles, generateScopeClass, getCompletions, getHoverInfo, getVariableDetail, getVariables, hasExecutedScripts, inspectObjectPath, parseCompletionContext, parseIdentifierAtPosition, renderHtml, scopeStyles, transformForPersistence, wrapForAsync };
//# sourceMappingURL=index.js.map
