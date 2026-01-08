# mrmd-js

MRP-compliant browser JavaScript runtime for notebook-style code execution with LSP-like features, multi-session isolation, and rich output rendering.

## Features

- **Notebook-style execution** - Variables persist across cell executions
- **MRP Protocol compliance** - Implements the MRMD Runtime Protocol
- **Multi-language support** - JavaScript, HTML, and CSS executors
- **LSP-like features** - Runtime-aware completions, hover info, variable inspection
- **Session isolation** - Multiple isolated execution contexts (iframe or main window)
- **Rich output** - Display data with HTML, CSS, images, and more
- **Streaming execution** - Real-time output with async generators
- **Code analysis** - Statement completeness checking and formatting

## Installation

```bash
npm install mrmd-js
```

## Quick Start

### Using MrpRuntime (Recommended)

```javascript
import { MrpRuntime } from 'mrmd-js';

const runtime = new MrpRuntime();

// Create a session
const session = runtime.createSession({ language: 'javascript' });

// Execute code - variables persist across executions
await session.execute(`
  const data = [1, 2, 3, 4, 5];
  const sum = data.reduce((a, b) => a + b, 0);
  console.log("Sum:", sum);
`);
// Output: Sum: 15

// Variables persist!
const result = await session.execute(`
  const doubled = data.map(n => n * 2);
  doubled
`);
console.log(result.resultString); // "[2, 4, 6, 8, 10]"

// Get completions
const completions = session.complete('data.', 5);
// → { matches: [{ label: 'map', kind: 'function' }, ...] }

// Get hover info
const hover = session.hover('sum', 1);
// → { found: true, name: 'sum', type: 'number', value: '15' }

// List all variables
const vars = session.listVariables();
// → [{ name: 'data', type: 'Array', expandable: true }, ...]

// Clean up
runtime.destroy();
```

### Using Session Directly

```javascript
import { SessionManager, createSessionManager } from 'mrmd-js';

const manager = createSessionManager();

// Create isolated sessions
const dataSession = manager.create({ id: 'data', language: 'javascript' });
const vizSession = manager.create({ id: 'viz', language: 'javascript' });

// Each session has its own scope
await dataSession.execute('const x = 100');
await vizSession.execute('const x = 200');

dataSession.listVariables(); // x = 100
vizSession.listVariables();  // x = 200 - completely isolated!

// Clean up
manager.destroyAll();
```

## API Reference

### MrpRuntime

The main entry point implementing the MRP protocol.

```javascript
import { MrpRuntime, createRuntime } from 'mrmd-js';

const runtime = new MrpRuntime({
  maxSessions: 10,                    // Max concurrent sessions
  defaultIsolation: 'iframe',         // 'iframe' or 'main'
  defaultAllowMainAccess: false,      // Allow main window access
});

// Or use factory function
const runtime = createRuntime();
```

#### Capabilities

```javascript
const caps = runtime.getCapabilities();
// {
//   runtime: 'mrmd-js',
//   version: '2.0.0',
//   languages: ['javascript', 'html', 'css'],
//   features: { execute: true, complete: true, ... },
//   maxSessions: 10,
//   environment: { userAgent: '...', platform: '...' }
// }
```

#### Session Management

```javascript
// Create session
const session = runtime.createSession({
  id: 'my-session',           // Optional ID
  language: 'javascript',     // Language
  isolation: 'iframe',        // 'iframe' or 'main'
  allowMainAccess: false,     // Access main window from iframe
});

// Get/list sessions
runtime.getSession('my-session');
runtime.listSessions();

// Get or create
runtime.getOrCreateSession('my-session', { language: 'javascript' });

// Reset/destroy
runtime.resetSession('my-session');
runtime.destroySession('my-session');
runtime.destroy(); // Destroy all
```

#### Convenience Methods

```javascript
// Execute in default session
const result = await runtime.execute('1 + 2');
const stream = runtime.executeStream('console.log("hi")');

// LSP features
runtime.complete('arr.', 4);
runtime.hover('myVar', 3);
runtime.inspect('obj', 2, { detail: 1 });
runtime.listVariables();
runtime.getVariable('myVar');

// Analysis
runtime.isComplete('const x = {');  // { status: 'incomplete', indent: '  ' }
await runtime.format('const x=1');  // { formatted: 'const x = 1;\n', changed: true }
```

### Session

Individual execution context with full LSP support.

```javascript
// Get session info
session.getInfo();
// { id: '...', language: 'javascript', executionCount: 5, ... }

// Execute code
const result = await session.execute('const x = 1 + 2; x');
// {
//   success: true,
//   stdout: '',
//   stderr: '',
//   result: 3,
//   resultString: '3',
//   duration: 5,
//   displayData: []
// }

// Streaming execution
for await (const event of session.executeStream('console.log("hi")')) {
  if (event.type === 'stdout') console.log(event.text);
  if (event.type === 'result') console.log(event.result);
}

// Interrupt execution
session.interrupt();

// Reset session (clear all variables)
session.reset();
```

#### LSP Features

```javascript
// Completions
const completions = session.complete('data.fi', 7);
// {
//   matches: [{ label: 'filter', kind: 'function', valuePreview: 'ƒ' }, ...],
//   cursorStart: 5,
//   cursorEnd: 7
// }

// Hover
const hover = session.hover('myArray', 3);
// { found: true, name: 'myArray', type: 'Array', value: '[1, 2, 3]' }

// Inspect (detailed)
const info = session.inspect('user', 2, { detail: 1 });
// { found: true, name: 'user', type: 'Object', children: [...] }

// Variables
const vars = session.listVariables({ types: ['Object', 'Array'] });
// [{ name: 'user', type: 'Object', expandable: true, size: '3 keys' }, ...]

const detail = session.getVariable('user', { depth: 2 });
// { name: 'user', type: 'Object', children: [...], methods: [...] }
```

#### Analysis

```javascript
// Check statement completeness
session.isComplete('const x = 1');   // { status: 'complete', indent: '' }
session.isComplete('const x = {');   // { status: 'incomplete', indent: '  ' }
session.isComplete('const const');   // { status: 'invalid', indent: '' }

// Format code
const formatted = await session.format('const x=1');
// { formatted: 'const x = 1;\n', changed: true }
```

### Executors

Built-in language executors.

```javascript
import {
  ExecutorRegistry,
  createDefaultExecutorRegistry,
  JavaScriptExecutor,
  HtmlExecutor,
  CssExecutor,
} from 'mrmd-js';

// Default registry includes JS, HTML, CSS
const registry = createDefaultExecutorRegistry();

// Check language support
registry.supports('javascript');  // true
registry.supports('js');          // true (alias)
registry.supports('html');        // true

// Get executor
const jsExecutor = registry.get('javascript');

// Register custom executor
registry.register('python', myPythonExecutor);
registry.registerAlias('py', 'python');
```

#### JavaScript Executor

Executes JavaScript with variable persistence and async support.

```javascript
import { JavaScriptExecutor, createJavaScriptExecutor } from 'mrmd-js';

const executor = createJavaScriptExecutor();

// Execute with context
const result = await executor.execute(code, context, {
  timeout: 30000,
  storeVariables: true,
});
```

#### HTML Executor

Executes HTML, extracting and running scripts.

```javascript
import { HtmlExecutor, createHtmlExecutor } from 'mrmd-js';

const executor = createHtmlExecutor();

const result = await executor.execute(`
  <div id="app">Hello</div>
  <script>
    document.getElementById('app').textContent = 'World';
  </script>
`, context);

// Returns displayData with text/html
```

#### CSS Executor

Applies CSS styles with optional scoping.

```javascript
import { CssExecutor, createCssExecutor } from 'mrmd-js';

const executor = createCssExecutor();

const result = await executor.execute(`
  .container { background: blue; }
`, context, { scope: '.my-scope' });

// Returns displayData with text/css
```

### Client Utilities

Utilities for rendering execution output.

#### HtmlRenderer

Render HTML displayData with script execution and isolation modes.

```javascript
import { HtmlRenderer, createHtmlRenderer } from 'mrmd-js';

const renderer = createHtmlRenderer();

// Render modes: 'direct', 'shadow', 'scoped'
renderer.render('<p>Hello</p>', container, { mode: 'direct' });

// Shadow DOM isolation
renderer.render('<p>Isolated</p>', container, { mode: 'shadow' });

// CSS scoped (prefixes selectors)
renderer.render('<style>.foo { color: red; }</style>', container, {
  mode: 'scoped',
  scopeClass: 'my-scope',
});

// Render displayData
renderer.renderDisplayData(displayData, container);
```

#### CssApplicator

Manage CSS styles in the document.

```javascript
import { CssApplicator, createCssApplicator } from 'mrmd-js';

const applicator = createCssApplicator();

// Apply CSS
const { id, element } = applicator.apply('.foo { color: red; }', {
  id: 'my-styles',
  scope: '.my-scope',  // Prefix selectors
});

// Update existing
applicator.apply('.foo { color: blue; }', { id: 'my-styles' });

// Remove
applicator.remove('my-styles');
applicator.clear();
```

#### AnsiRenderer

Convert ANSI escape codes to HTML.

```javascript
import { AnsiRenderer, ansiToHtml, stripAnsi } from 'mrmd-js';

// Convert to HTML
const html = ansiToHtml('\x1b[31mRed text\x1b[0m');
// '<span style="color:#cc0000">Red text</span>'

// Strip ANSI codes
const plain = stripAnsi('\x1b[1mBold\x1b[0m');
// 'Bold'

// Renderer instance
const renderer = new AnsiRenderer({ escapeHtml: true });
renderer.renderTo(ansiText, container);
```

### Analysis Utilities

Standalone code analysis functions.

```javascript
import {
  isComplete,
  getSuggestedIndent,
  formatCode,
  basicFormat,
  formatHtml,
  formatCss,
  setPrettier,
} from 'mrmd-js';

// Statement completeness
isComplete('const x = 1');  // { status: 'complete', indent: '' }
isComplete('function f() {');  // { status: 'incomplete', indent: '  ' }

// Suggested indent for continuation
getSuggestedIndent('if (true) {');  // '  '

// Format code (async, uses Prettier if available)
await formatCode('const x=1', { tabWidth: 2 });

// Basic formatting (sync, no dependencies)
basicFormat('const x=1');

// Inject Prettier for better formatting
import * as prettier from 'prettier';
setPrettier(prettier);
```

### LSP Utilities

Low-level LSP helpers for custom integrations.

```javascript
import {
  // Parsing
  parseIdentifierAtPosition,
  parseCompletionContext,
  getStringOrCommentContext,
  splitObjectPath,
  isKeyword,

  // Formatting
  formatValue,
  formatValueShort,
  getTypeName,
  isExpandable,
  getFunctionSignature,

  // Completions/Hover/Inspect
  getCompletions,
  getHoverInfo,
  getInspectInfo,
  listVariables,
  expandVariable,
} from 'mrmd-js';

// Parse context at cursor
const ctx = parseCompletionContext('obj.foo', 7);
// { type: 'member', object: 'obj', prefix: 'foo' }

// Format values for display
formatValue({ a: 1, b: 2 });  // '{ a: 1, b: 2 }'
formatValueShort(largeObject, 50);  // Truncated

// Type utilities
getTypeName([1, 2, 3]);  // 'Array'
isExpandable({ a: 1 });  // true
```

## Types

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;              // Completed without error
  stdout: string;                // Captured console.log output
  stderr: string;                // Captured console.error/warn
  result?: unknown;              // Return value
  resultString?: string;         // String representation
  error?: ExecutionError;        // Error details if failed
  duration?: number;             // Execution time (ms)
  displayData?: DisplayData[];   // Rich outputs
}

interface ExecutionError {
  name: string;      // Error type
  message: string;   // Error message
  stack?: string;    // Stack trace
  line?: number;     // Line number
  column?: number;   // Column number
}

interface DisplayData {
  data: Record<string, string>;  // MIME type → content
  metadata?: Record<string, unknown>;
}
```

### CompletionResult

```typescript
interface CompletionResult {
  matches: CompletionItem[];  // Suggestions
  cursorStart: number;        // Replace from
  cursorEnd: number;          // Replace to
  source: 'runtime' | 'static';
}

interface CompletionItem {
  label: string;              // Text to insert
  kind: string;               // 'function' | 'property' | 'variable' | ...
  type?: string;              // Value type
  valuePreview?: string;      // Current value preview
  documentation?: string;     // Description
  sortText?: string;          // Sort order
}
```

### HoverResult

```typescript
interface HoverResult {
  found: boolean;
  name?: string;
  type?: string;
  value?: string;
  signature?: string;  // For functions
}
```

### InspectResult

```typescript
interface InspectResult {
  found: boolean;
  name?: string;
  type?: string;
  kind?: string;
  value?: unknown;
  signature?: string;
  source?: string;
  documentation?: string;
  children?: ChildInfo[];
}
```

### VariableInfo

```typescript
interface VariableInfo {
  name: string;
  type: string;
  value: string;
  size?: string;           // '5 items', '3 keys'
  expandable?: boolean;
}

interface VariableDetail extends VariableInfo {
  children?: VariableInfo[];
  methods?: MethodInfo[];
  attributes?: AttributeInfo[];
}
```

### IsCompleteResult

```typescript
interface IsCompleteResult {
  status: 'complete' | 'incomplete' | 'invalid' | 'unknown';
  indent: string;  // Suggested indent for continuation
}
```

## Isolation Modes

### Iframe Isolation (Default)

Code executes in a hidden iframe with full isolation:

```
┌─────────────────────────────────────────┐
│              Main Page                   │
│  ┌───────────────────────────────────┐  │
│  │  <iframe sandbox="allow-scripts   │  │
│  │           allow-same-origin">     │  │
│  │                                   │  │
│  │    Session code runs here         │  │
│  │    - Isolated global scope        │  │
│  │    - Full browser APIs            │  │
│  │    - Can't access parent*         │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

* Unless allowMainAccess: true
```

### Main Context

Execute directly in the host page's window:

```javascript
const session = runtime.createSession({
  language: 'javascript',
  isolation: 'main',
});

// Access real page DOM
await session.execute(`
  document.title = 'Modified!';
  console.log(window.myAppState);
`);
```

## How It Works

### Variable Persistence

Top-level declarations are transformed to persist in the global scope:

```javascript
// Your code
const x = 1;
let y = 2;
function greet() { return 'hi'; }

// Transformed
x = 1;
y = 2;
greet = function() { return 'hi'; }
```

### Async Support

Code is automatically wrapped for top-level await:

```javascript
// Your code
const data = await fetch('/api');
data.json()

// Executed as
(async () => {
  data = await fetch('/api');
  return data.json();
})()
```

### Runtime Completions

Unlike static analysis, completions come from actual runtime values:

```javascript
const obj = { foo: 1, bar: 2 };
// Typing "obj." shows actual properties: foo, bar

const dynamicObj = JSON.parse(apiResponse);
// Shows actual parsed properties, not just "any"
```

## Examples

### Data Analysis

```javascript
const runtime = new MrpRuntime();
const session = runtime.createSession({ language: 'javascript' });

// Cell 1: Load data
await session.execute(`
  const sales = [
    { month: 'Jan', revenue: 1200 },
    { month: 'Feb', revenue: 1800 },
    { month: 'Mar', revenue: 2400 },
  ];
`);

// Cell 2: Analyze
await session.execute(`
  const total = sales.reduce((sum, s) => sum + s.revenue, 0);
  const avg = total / sales.length;
  console.log('Total:', total, 'Average:', avg.toFixed(2));
`);
// Output: Total: 5400 Average: 1800.00

// Explore variables
session.listVariables();
// [{ name: 'sales', type: 'Array', size: '3 items' }, ...]
```

### Streaming Output

```javascript
const stream = session.executeStream(`
  for (let i = 1; i <= 5; i++) {
    console.log('Processing', i);
    await new Promise(r => setTimeout(r, 500));
  }
`);

for await (const event of stream) {
  if (event.type === 'stdout') {
    updateUI(event.text);  // Real-time updates
  }
}
```

### HTML/CSS Rendering

```javascript
// HTML cell
const htmlResult = await session.execute(`
  <div class="card">
    <h2>Hello World</h2>
    <p>This is rendered HTML</p>
  </div>
`, { executor: 'html' });

// CSS cell
const cssResult = await session.execute(`
  .card {
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
`, { executor: 'css' });

// Render with utilities
const renderer = createHtmlRenderer();
renderer.renderDisplayData(htmlResult.displayData[0], container);

const applicator = createCssApplicator();
applicator.applyDisplayData(cssResult.displayData[0]);
```

### Variable Explorer

```javascript
await session.execute(`
  const user = {
    name: 'Alice',
    profile: {
      email: 'alice@example.com',
      settings: { theme: 'dark' }
    }
  };
`);

// Get top-level variables
const vars = session.listVariables();

// Expand nested object
const detail = session.getVariable('user', { depth: 2 });
// {
//   name: 'user',
//   type: 'Object',
//   children: [
//     { name: 'name', type: 'string', value: '"Alice"' },
//     { name: 'profile', type: 'Object', expandable: true, ... }
//   ]
// }
```

## Test Application

A test playground is included:

```bash
# Build and serve
npm run demo

# Or manually
npm run build
npm run serve
# Open http://localhost:3000
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+

Requires:
- ES2020+ (async/await, optional chaining)
- iframe sandbox support
- Blob URLs

## License

MIT
