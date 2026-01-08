# mrmd-js Implementation Plan

## MRP-Compliant Browser JavaScript Runtime

**Version:** 2.0.0 (complete rewrite)
**Status:** Planning

---

## Overview

mrmd-js is a **browser-based implementation of the MRMD Runtime Protocol (MRP)**. It provides JavaScript, HTML, and CSS execution in the browser with full MRP compliance.

### Key Principles

1. **MRP-Native** — API mirrors MRP exactly, just as methods instead of HTTP
2. **Complete** — All MRP features implemented, no "TODO later"
3. **Type-Safe** — Full TypeScript with strict types matching MRP spec
4. **Zero Dependencies** — Pure browser APIs, no external runtime deps
5. **Utility-Rich** — Includes helpers for clients to render displayData

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  mrmd-js                                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MrpRuntime (main entry point)                                      │   │
│  │  - getCapabilities()                                                │   │
│  │  - createSession() / listSessions() / destroySession()              │   │
│  │  - execute() / executeStream()                                      │   │
│  │  - complete() / hover() / inspect()                                 │   │
│  │  - listVariables() / getVariable()                                  │   │
│  │  - isComplete() / format()                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SessionManager                                                     │   │
│  │  - Manages multiple isolated sessions                               │   │
│  │  - Tracks session lifecycle and stats                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Session                                                            │   │
│  │  - Owns an ExecutionContext (iframe/worker/main)                    │   │
│  │  - Routes to ExecutorRegistry by language                           │   │
│  │  - Provides LSP features via context introspection                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│          ┌───────────────────┼───────────────────┐                         │
│          ▼                   ▼                   ▼                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│  │ IframeContext│   │ WorkerContext│   │ MainContext  │                    │
│  │ (default)    │   │ (optional)   │   │ (no isolate) │                    │
│  └──────────────┘   └──────────────┘   └──────────────┘                    │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ExecutorRegistry                                                   │   │
│  │  - JavaScriptExecutor (js, javascript)                              │   │
│  │  - HtmlExecutor (html, htm)                                         │   │
│  │  - CssExecutor (css, style)                                         │   │
│  │  - Custom executors can be registered                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LSP Features                                                       │   │
│  │  - complete.ts: Runtime-aware completions                           │   │
│  │  - hover.ts: Type and value preview                                 │   │
│  │  - inspect.ts: Full symbol information                              │   │
│  │  - variables.ts: Namespace exploration                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Client Utilities (for apps using mrmd-js)                          │   │
│  │  - HtmlRenderer: Render text/html displayData                       │   │
│  │  - CssApplicator: Apply text/css displayData                        │   │
│  │  - AnsiRenderer: Convert ANSI to HTML                               │   │
│  │  - AssetManager: Handle blob URLs                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
mrmd-js/
├── src/
│   ├── index.ts                    # Public exports
│   ├── runtime.ts                  # MrpRuntime class
│   ├── types/
│   │   ├── index.ts                # Re-exports
│   │   ├── capabilities.ts         # Capabilities types
│   │   ├── session.ts              # Session types
│   │   ├── execution.ts            # Execution types
│   │   ├── streaming.ts            # Stream event types
│   │   ├── completion.ts           # Completion types
│   │   ├── inspection.ts           # Inspect/hover types
│   │   ├── variables.ts            # Variable types
│   │   └── analysis.ts             # isComplete/format types
│   │
│   ├── session/
│   │   ├── index.ts                # Session exports
│   │   ├── manager.ts              # SessionManager class
│   │   ├── session.ts              # Session class
│   │   ├── context/
│   │   │   ├── index.ts            # Context exports
│   │   │   ├── interface.ts        # ExecutionContext interface
│   │   │   ├── iframe.ts           # IframeContext
│   │   │   ├── worker.ts           # WorkerContext
│   │   │   └── main.ts             # MainContext
│   │   └── console-capture.ts      # Console interception
│   │
│   ├── execute/
│   │   ├── index.ts                # Executor exports
│   │   ├── registry.ts             # ExecutorRegistry
│   │   ├── interface.ts            # Executor interface
│   │   ├── javascript.ts           # JavaScriptExecutor
│   │   ├── html.ts                 # HtmlExecutor
│   │   └── css.ts                  # CssExecutor
│   │
│   ├── transform/
│   │   ├── index.ts                # Transform exports
│   │   ├── persistence.ts          # const/let → var
│   │   ├── async.ts                # Top-level await wrapper
│   │   ├── extract.ts              # Extract declared variables
│   │   └── last-expression.ts      # Capture last expression value
│   │
│   ├── lsp/
│   │   ├── index.ts                # LSP exports
│   │   ├── complete.ts             # Completions
│   │   ├── hover.ts                # Hover info
│   │   ├── inspect.ts              # Symbol inspection
│   │   ├── variables.ts            # Variable listing
│   │   ├── parse.ts                # Code parsing utilities
│   │   └── format.ts               # Value formatting
│   │
│   ├── analysis/
│   │   ├── index.ts                # Analysis exports
│   │   ├── is-complete.ts          # Statement completeness
│   │   └── format.ts               # Code formatting (prettier)
│   │
│   ├── utils/
│   │   ├── index.ts                # Utility exports
│   │   ├── html-renderer.ts        # Render HTML displayData
│   │   ├── css-applicator.ts       # Apply CSS displayData
│   │   ├── ansi-renderer.ts        # ANSI → HTML
│   │   ├── asset-manager.ts        # Blob URL management
│   │   └── scope.ts                # CSS scoping utilities
│   │
│   └── constants.ts                # Runtime constants
│
├── tests/
│   ├── runtime.test.ts
│   ├── session.test.ts
│   ├── execute/
│   │   ├── javascript.test.ts
│   │   ├── html.test.ts
│   │   └── css.test.ts
│   ├── lsp/
│   │   ├── complete.test.ts
│   │   ├── hover.test.ts
│   │   └── variables.test.ts
│   └── utils/
│       └── html-renderer.test.ts
│
├── package.json
├── tsconfig.json
├── rollup.config.js
├── vitest.config.ts
└── README.md
```

---

## MRP Endpoint Mapping

Every MRP endpoint maps to a method:

| MRP Endpoint | mrmd-js Method |
|--------------|----------------|
| `GET /capabilities` | `runtime.getCapabilities()` |
| `GET /sessions` | `runtime.listSessions()` |
| `POST /sessions` | `runtime.createSession(options)` |
| `GET /sessions/{id}` | `runtime.getSession(id)` or `session.getInfo()` |
| `DELETE /sessions/{id}` | `runtime.destroySession(id)` |
| `POST /sessions/{id}/reset` | `session.reset()` |
| `POST /execute` | `session.execute(code, options)` |
| `POST /execute/stream` | `session.executeStream(code, options)` |
| `POST /input` | `session.sendInput(execId, text)` |
| `POST /interrupt` | `session.interrupt()` |
| `POST /complete` | `session.complete(code, cursor, options)` |
| `POST /inspect` | `session.inspect(code, cursor, options)` |
| `POST /hover` | `session.hover(code, cursor)` |
| `POST /variables` | `session.listVariables(filter)` |
| `POST /variables/{name}` | `session.getVariable(name, options)` |
| `POST /is_complete` | `session.isComplete(code)` |
| `POST /format` | `session.format(code)` |
| `GET /assets/{path}` | `runtime.getAsset(path)` (returns blob URL) |

---

## Type Definitions

### Capabilities

```typescript
// src/types/capabilities.ts

export interface Capabilities {
  /** Runtime identifier */
  runtime: string;

  /** Runtime version */
  version: string;

  /** Supported language identifiers */
  languages: string[];

  /** Feature support flags */
  features: Features;

  /** LSP fallback WebSocket URL (not applicable for browser) */
  lspFallback?: string;

  /** Default session ID */
  defaultSession: string;

  /** Maximum concurrent sessions */
  maxSessions: number;

  /** Environment information */
  environment: BrowserEnvironment;
}

export interface Features {
  /** Execute code and return result */
  execute: boolean;

  /** Stream execution output via async iterator */
  executeStream: boolean;

  /** Interrupt running execution */
  interrupt: boolean;

  /** Tab completion from live session */
  complete: boolean;

  /** Get symbol info (signature, docs, source) */
  inspect: boolean;

  /** Quick value/type preview */
  hover: boolean;

  /** List variables in namespace */
  variables: boolean;

  /** Drill into objects (children, attributes) */
  variableExpand: boolean;

  /** Clear namespace without destroying session */
  reset: boolean;

  /** Check if code is a complete statement */
  isComplete: boolean;

  /** Format/prettify code */
  format: boolean;

  /** Asset support (blob URLs in browser) */
  assets: boolean;
}

export interface BrowserEnvironment {
  /** User agent string */
  userAgent: string;

  /** Browser language */
  language: string;

  /** Platform */
  platform: string;

  /** Is secure context (HTTPS) */
  isSecureContext: boolean;
}
```

### Sessions

```typescript
// src/types/session.ts

export interface SessionInfo {
  /** Unique session identifier */
  id: string;

  /** Primary language for this session */
  language: string;

  /** ISO timestamp of creation */
  created: string;

  /** ISO timestamp of last activity */
  lastActivity: string;

  /** Number of executions in this session */
  executionCount: number;

  /** Number of variables in namespace */
  variableCount: number;

  /** Session isolation mode */
  isolation: IsolationMode;
}

export type IsolationMode = 'iframe' | 'worker' | 'none';

export interface CreateSessionOptions {
  /** Session ID (generated if not provided) */
  id?: string;

  /** Primary language (default: 'javascript') */
  language?: string;

  /** Isolation mode (default: 'iframe') */
  isolation?: IsolationMode;

  /**
   * Allow access to main document from isolated context.
   * Adds `mainDocument` and `mainWindow` to context.
   */
  allowMainAccess?: boolean;

  /** Custom utilities to inject into context */
  utilities?: Record<string, unknown>;
}
```

### Execution

```typescript
// src/types/execution.ts

export interface ExecuteOptions {
  /** Session ID (default: 'default') */
  session?: string;

  /** Language override (auto-detected from session if not provided) */
  language?: string;

  /** Add to execution history (default: true) */
  storeHistory?: boolean;

  /** Suppress output (default: false) */
  silent?: boolean;

  /** Unique execution identifier */
  execId?: string;

  /** Cell identifier (for linking) */
  cellId?: string;

  /** Metadata from code fence */
  cellMeta?: Record<string, unknown>;
}

export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Standard output (console.log, etc.) */
  stdout: string;

  /** Standard error (console.error, etc.) */
  stderr: string;

  /** Return value (raw) */
  result?: unknown;

  /** Return value (formatted string) */
  resultString?: string;

  /** Error information if failed */
  error?: ExecutionError;

  /** Rich display outputs */
  displayData: DisplayData[];

  /** Generated assets (images, files) */
  assets: Asset[];

  /** Execution count in session */
  executionCount: number;

  /** Execution duration in milliseconds */
  duration: number;

  /** Detected imports (for dependency tracking) */
  imports?: string[];
}

export interface ExecutionError {
  /** Error type/class name */
  type: string;

  /** Error message */
  message: string;

  /** Stack trace lines */
  traceback?: string[];

  /** Line number where error occurred */
  line?: number;

  /** Column number where error occurred */
  column?: number;
}

export interface DisplayData {
  /** MIME type → content mapping */
  data: Record<string, string>;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export interface Asset {
  /** Asset path/identifier */
  path: string;

  /** URL to access asset (blob URL in browser) */
  url: string;

  /** MIME type */
  mimeType: string;

  /** Asset type category */
  assetType: 'image' | 'html' | 'json' | 'other';

  /** Size in bytes */
  size?: number;
}
```

### Streaming

```typescript
// src/types/streaming.ts

export type StreamEvent =
  | StartEvent
  | StdoutEvent
  | StderrEvent
  | StdinRequestEvent
  | DisplayEvent
  | AssetEvent
  | ResultEvent
  | ErrorEvent
  | DoneEvent;

export interface StartEvent {
  type: 'start';
  execId: string;
  timestamp: string;
}

export interface StdoutEvent {
  type: 'stdout';
  content: string;
  accumulated: string;
}

export interface StderrEvent {
  type: 'stderr';
  content: string;
  accumulated: string;
}

export interface StdinRequestEvent {
  type: 'stdin_request';
  prompt: string;
  password: boolean;
  execId: string;
}

export interface DisplayEvent {
  type: 'display';
  data: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface AssetEvent {
  type: 'asset';
  path: string;
  url: string;
  mimeType: string;
  assetType: string;
}

export interface ResultEvent {
  type: 'result';
  result: ExecutionResult;
}

export interface ErrorEvent {
  type: 'error';
  error: ExecutionError;
}

export interface DoneEvent {
  type: 'done';
}
```

### Completions

```typescript
// src/types/completion.ts

export interface CompleteOptions {
  /** Session ID */
  session?: string;

  /** What triggered completion */
  triggerKind?: TriggerKind;

  /** Character that triggered (if triggerKind is 'character') */
  triggerCharacter?: string;
}

export type TriggerKind = 'invoked' | 'character' | 'incomplete';

export interface CompletionResult {
  /** Completion items */
  matches: CompletionItem[];

  /** Start of text to replace */
  cursorStart: number;

  /** End of text to replace */
  cursorEnd: number;

  /** Where completions came from */
  source: CompletionSource;
}

export type CompletionSource = 'runtime' | 'lsp' | 'static';

export interface CompletionItem {
  /** Display label */
  label: string;

  /** Text to insert (if different from label) */
  insertText?: string;

  /** Item kind for icon */
  kind: CompletionKind;

  /** Short description */
  detail?: string;

  /** Documentation (markdown) */
  documentation?: string;

  /** Live value preview (from runtime) */
  valuePreview?: string;

  /** Type string */
  type?: string;

  /** Sort priority (lower = higher priority) */
  sortPriority?: number;
}

export type CompletionKind =
  | 'variable'
  | 'function'
  | 'method'
  | 'property'
  | 'class'
  | 'module'
  | 'keyword'
  | 'constant'
  | 'field'
  | 'value'
  | 'snippet';
```

### Inspection

```typescript
// src/types/inspection.ts

export interface InspectOptions {
  /** Session ID */
  session?: string;

  /** Detail level: 0=signature, 1=+docs, 2=+source */
  detail?: 0 | 1 | 2;
}

export interface InspectResult {
  /** Whether symbol was found */
  found: boolean;

  /** Where info came from */
  source: 'runtime' | 'lsp' | 'static';

  /** Symbol name */
  name?: string;

  /** Symbol kind */
  kind?: string;

  /** Type string */
  type?: string;

  /** Function/method signature */
  signature?: string;

  /** Documentation string */
  docstring?: string;

  /** Source code (if available, detail >= 2) */
  sourceCode?: string;

  /** File where defined */
  file?: string;

  /** Line number */
  line?: number;

  /** Value preview */
  value?: string;

  /** Children (for expandable objects) */
  children?: VariableInfo[];
}

export interface HoverResult {
  /** Whether info was found */
  found: boolean;

  /** Symbol name */
  name?: string;

  /** Type string */
  type?: string;

  /** Value preview */
  value?: string;

  /** Function signature */
  signature?: string;
}
```

### Variables

```typescript
// src/types/variables.ts

export interface VariableFilter {
  /** Only include these types */
  types?: string[];

  /** Name must match this regex */
  namePattern?: string;

  /** Exclude names starting with _ */
  excludePrivate?: boolean;
}

export interface VariableInfo {
  /** Variable name */
  name: string;

  /** Type string */
  type: string;

  /** Value preview (truncated) */
  value: string;

  /** Size description (e.g., "1.2 KB", "3 items") */
  size?: string;

  /** Whether this can be expanded */
  expandable: boolean;

  /** Shape for arrays/matrices */
  shape?: number[];

  /** Data type for typed arrays */
  dtype?: string;

  /** Length for arrays/strings */
  length?: number;

  /** Keys for objects/maps */
  keys?: string[];
}

export interface VariableDetailOptions {
  /** Session ID */
  session?: string;

  /** Path to drill into (e.g., ['items', '0', 'name']) */
  path?: string[];

  /** Max children to return */
  maxChildren?: number;

  /** Max characters for value strings */
  maxValueLength?: number;
}

export interface VariableDetail extends VariableInfo {
  /** Full value (up to maxValueLength) */
  fullValue?: string;

  /** Child items */
  children?: VariableInfo[];

  /** Available methods */
  methods?: string[];

  /** Available attributes/properties */
  attributes?: string[];

  /** Whether results were truncated */
  truncated: boolean;
}
```

### Analysis

```typescript
// src/types/analysis.ts

export interface IsCompleteResult {
  /** Completeness status */
  status: 'complete' | 'incomplete' | 'invalid' | 'unknown';

  /** Suggested indent for continuation */
  indent?: string;
}

export interface FormatResult {
  /** Formatted code */
  formatted: string;

  /** Whether code was changed */
  changed: boolean;
}
```

---

## Core Implementations

### MrpRuntime

```typescript
// src/runtime.ts

export interface MrpRuntimeOptions {
  /** Maximum concurrent sessions */
  maxSessions?: number;

  /** Default isolation mode for new sessions */
  defaultIsolation?: IsolationMode;

  /** Whether to allow main context access by default */
  defaultAllowMainAccess?: boolean;
}

export class MrpRuntime {
  private sessionManager: SessionManager;
  private executorRegistry: ExecutorRegistry;
  private assetManager: AssetManager;
  private options: Required<MrpRuntimeOptions>;

  constructor(options?: MrpRuntimeOptions);

  // === Capabilities ===
  getCapabilities(): Capabilities;

  // === Sessions ===
  listSessions(): SessionInfo[];
  createSession(options?: CreateSessionOptions): Session;
  getSession(id: string): Session | undefined;
  getOrCreateSession(id: string, options?: CreateSessionOptions): Session;
  destroySession(id: string): boolean;

  // === Convenience execution (uses default session) ===
  execute(code: string, options?: ExecuteOptions): Promise<ExecutionResult>;
  executeStream(code: string, options?: ExecuteOptions): AsyncGenerator<StreamEvent>;

  // === Convenience LSP (uses default session) ===
  complete(code: string, cursor: number, options?: CompleteOptions): CompletionResult;
  hover(code: string, cursor: number, session?: string): HoverResult;
  inspect(code: string, cursor: number, options?: InspectOptions): InspectResult;
  listVariables(filter?: VariableFilter, session?: string): VariableInfo[];
  getVariable(name: string, options?: VariableDetailOptions): VariableDetail | null;

  // === Analysis ===
  isComplete(code: string, session?: string): IsCompleteResult;
  format(code: string, session?: string): Promise<FormatResult>;

  // === Assets ===
  getAsset(path: string): string | null; // Returns blob URL

  // === Extensibility ===
  registerExecutor(language: string, executor: Executor): void;
  registerLanguageAlias(alias: string, language: string): void;

  // === Lifecycle ===
  destroy(): void;
}
```

### Session

```typescript
// src/session/session.ts

export class Session {
  readonly id: string;
  readonly language: string;
  readonly created: Date;
  readonly isolation: IsolationMode;

  private context: ExecutionContext;
  private executorRegistry: ExecutorRegistry;
  private executionCount: number;
  private lastActivity: Date;
  private pendingInputs: Map<string, (text: string) => void>;
  private runningExecutions: Map<string, AbortController>;

  constructor(
    id: string,
    executorRegistry: ExecutorRegistry,
    options?: CreateSessionOptions
  );

  // === Execution ===
  execute(code: string, options?: ExecuteOptions): Promise<ExecutionResult>;
  executeStream(code: string, options?: ExecuteOptions): AsyncGenerator<StreamEvent>;
  sendInput(execId: string, text: string): boolean;
  interrupt(execId?: string): boolean;

  // === LSP ===
  complete(code: string, cursor: number, options?: CompleteOptions): CompletionResult;
  hover(code: string, cursor: number): HoverResult;
  inspect(code: string, cursor: number, options?: InspectOptions): InspectResult;
  listVariables(filter?: VariableFilter): VariableInfo[];
  getVariable(name: string, options?: VariableDetailOptions): VariableDetail | null;

  // === Analysis ===
  isComplete(code: string): IsCompleteResult;
  format(code: string): Promise<FormatResult>;

  // === Lifecycle ===
  reset(): void;
  destroy(): void;
  getInfo(): SessionInfo;
}
```

### ExecutionContext Interface

```typescript
// src/session/context/interface.ts

export interface ExecutionContext {
  /** Execute code and return raw result */
  execute(code: string): Promise<RawExecutionResult>;

  /** Get all user-defined variables */
  getVariables(): Record<string, unknown>;

  /** Get a specific variable by name or path */
  getVariable(name: string): unknown;

  /** Check if variable exists */
  hasVariable(name: string): boolean;

  /** Get the global object (window or equivalent) */
  getGlobal(): WindowProxy;

  /** Track a declared variable name */
  trackVariable(name: string): void;

  /** Get all tracked variable names */
  getTrackedVariables(): Set<string>;

  /** Clear all variables and state */
  reset(): void;

  /** Cleanup and release resources */
  destroy(): void;

  /** Whether this is the main window context */
  isMainContext(): boolean;

  /** Get the iframe element if applicable */
  getIframe(): HTMLIFrameElement | null;
}

export interface RawExecutionResult {
  /** Return value */
  result: unknown;

  /** Captured log entries */
  logs: LogEntry[];

  /** Error if execution failed */
  error?: Error;

  /** Duration in milliseconds */
  duration: number;
}

export interface LogEntry {
  type: 'log' | 'info' | 'warn' | 'error';
  args: unknown[];
  timestamp: number;
}
```

### Executor Interface

```typescript
// src/execute/interface.ts

export interface Executor {
  /** Languages this executor handles */
  readonly languages: readonly string[];

  /** Execute code */
  execute(
    code: string,
    context: ExecutionContext,
    options?: ExecuteOptions
  ): Promise<ExecutionResult>;

  /** Execute with streaming (optional) */
  executeStream?(
    code: string,
    context: ExecutionContext,
    options?: ExecuteOptions
  ): AsyncGenerator<StreamEvent>;
}
```

---

## Client Utilities

### HtmlRenderer

```typescript
// src/utils/html-renderer.ts

export type RenderMode = 'direct' | 'shadow' | 'scoped';

export interface RenderOptions {
  /** Rendering mode */
  mode?: RenderMode;

  /** Scope class for 'scoped' mode */
  scopeClass?: string;

  /** Execute inline scripts */
  executeScripts?: boolean;

  /** Script error callback */
  onScriptError?: (error: Error, script: string) => void;

  /** Whether to clear container first */
  clear?: boolean;
}

export interface RenderResult {
  /** Container element */
  container: HTMLElement;

  /** Shadow root if shadow mode */
  shadowRoot?: ShadowRoot;

  /** Number of scripts executed */
  scriptsExecuted: number;

  /** Script errors */
  scriptErrors: Error[];
}

export class HtmlRenderer {
  /** Render HTML string into container */
  render(html: string, container: HTMLElement, options?: RenderOptions): RenderResult;

  /** Render displayData into container */
  renderDisplayData(displayData: DisplayData, container: HTMLElement, options?: RenderOptions): RenderResult;

  /** Clear scripts for re-execution */
  clearScripts(execId?: string): void;
}

export function createHtmlRenderer(): HtmlRenderer;
```

### CssApplicator

```typescript
// src/utils/css-applicator.ts

export interface ApplyOptions {
  /** Scope CSS to this class */
  scopeClass?: string;

  /** Apply to this container */
  container?: HTMLElement;
}

export interface ApplyResult {
  /** Created style element */
  styleElement: HTMLStyleElement;

  /** Scope class applied */
  scopeClass?: string;
}

export class CssApplicator {
  /** Apply CSS string */
  apply(css: string, options?: ApplyOptions): ApplyResult;

  /** Apply CSS displayData */
  applyDisplayData(displayData: DisplayData, options?: ApplyOptions): ApplyResult;

  /** Remove applied styles by scope */
  remove(scopeClass: string): boolean;

  /** Clear all applied styles */
  clear(): void;
}

// Utility functions
export function scopeStyles(css: string, scopeSelector: string): string;
export function generateScopeClass(id?: string): string;
export function createStyleElement(css: string): HTMLStyleElement;
```

### AnsiRenderer

```typescript
// src/utils/ansi-renderer.ts

export interface AnsiRenderOptions {
  /** CSS class prefix */
  classPrefix?: string;

  /** Use inline styles instead of classes */
  inlineStyles?: boolean;
}

export class AnsiRenderer {
  /** Convert ANSI string to HTML */
  toHtml(text: string, options?: AnsiRenderOptions): string;

  /** Process text through terminal buffer (handles \r, cursor movement) */
  processTerminal(text: string): string;
}

export function createAnsiRenderer(): AnsiRenderer;
```

### AssetManager

```typescript
// src/utils/asset-manager.ts

export class AssetManager {
  /** Create blob URL for content */
  createAsset(content: Blob | string, mimeType: string, name?: string): Asset;

  /** Get asset by path */
  getAsset(path: string): Asset | undefined;

  /** Get blob URL by path */
  getUrl(path: string): string | undefined;

  /** List all assets */
  listAssets(): Asset[];

  /** Revoke blob URL and remove asset */
  removeAsset(path: string): boolean;

  /** Clear all assets */
  clear(): void;
}

export function createAssetManager(): AssetManager;
```

---

## Implementation Phases

### Phase 1: Core Types & Infrastructure
- [ ] All type definitions in `src/types/`
- [ ] ExecutionContext interface and implementations
- [ ] Console capture utility
- [ ] Code transformation utilities

### Phase 2: Session Management
- [ ] Session class with full lifecycle
- [ ] SessionManager with limits and tracking
- [ ] IframeContext implementation
- [ ] MainContext implementation

### Phase 3: Execution
- [ ] ExecutorRegistry
- [ ] JavaScriptExecutor with streaming
- [ ] HtmlExecutor (produces displayData)
- [ ] CssExecutor (produces displayData)

### Phase 4: LSP Features
- [ ] Completion with live values
- [ ] Hover with type/value preview
- [ ] Inspect with docs and source
- [ ] Variables with expansion

### Phase 5: Analysis
- [ ] isComplete (statement checker)
- [ ] format (prettier integration)

### Phase 6: MrpRuntime
- [ ] Full MrpRuntime class
- [ ] Capabilities reporting
- [ ] Asset management

### Phase 7: Client Utilities
- [ ] HtmlRenderer
- [ ] CssApplicator
- [ ] AnsiRenderer
- [ ] AssetManager

### Phase 8: Testing & Polish
- [ ] Unit tests for all modules
- [ ] Integration tests
- [ ] Documentation
- [ ] Examples

---

## mrmd-node (Separate Package)

A separate `mrmd-node` package will implement MRP as an actual HTTP/SSE server:

```
mrmd-node/
├── src/
│   ├── index.ts              # Exports
│   ├── server.ts             # HTTP server (Express/Fastify)
│   ├── routes/               # MRP endpoint handlers
│   │   ├── capabilities.ts
│   │   ├── sessions.ts
│   │   ├── execute.ts
│   │   ├── complete.ts
│   │   └── ...
│   ├── runtime.ts            # Core runtime (vm-based)
│   ├── session/
│   │   ├── session.ts
│   │   └── vm-context.ts     # Node vm isolation
│   └── assets/
│       └── file-manager.ts   # File-based assets
├── bin/
│   └── mrmd-node             # CLI
└── package.json
```

Features:
- Real HTTP/SSE server on configurable port
- Node.js `vm.createContext()` for isolation
- File system access for assets
- TypeScript support via esbuild
- Can run as subprocess or standalone

---

## Migration from Current mrmd-js

The current mrmd-js has:
- `JavaScriptClient` → becomes internal to Session
- `JavaScriptExecutor` → refactored as Executor
- `JavaScriptRuntime` → becomes MrpRuntime
- `HtmlRenderer` → moves to utils
- LSP features → reorganized under `src/lsp/`

Breaking changes:
- API completely restructured to match MRP
- Sessions are now first-class
- Streaming uses AsyncGenerator not callbacks

---

## Success Criteria

1. **MRP Compliant** — All endpoints from PROTOCOL.md implemented
2. **Type Safe** — Full TypeScript coverage, no `any`
3. **Well Tested** — >90% test coverage
4. **Documented** — JSDoc on all public APIs
5. **Performant** — Streaming works smoothly
6. **Extensible** — Custom executors easy to add
