# mrmd-js

A browser-side JavaScript runtime for notebook-style code execution with LSP-like features, multi-scope isolation, and visible artifact rendering.

## Goals

**mrmd-js** provides the execution layer for JavaScript in computational notebooks. It aims to:

1. **Notebook-style execution** - Variables persist across cell executions
2. **IDE-like features** - Runtime-based completions, hover info, variable explorer
3. **Multi-scope isolation** - Run code in separate, isolated environments
4. **Artifact rendering** - Display visualizations in visible iframes
5. **Page integration** - Optionally access the host page's DOM and JavaScript

## Installation

```bash
npm install mrmd-js
```

## Quick Start

### Basic Usage

```typescript
import { JavaScriptClient } from 'mrmd-js';

const client = new JavaScriptClient();

// Cell 1: Define variables
await client.execute(`
  const data = [1, 2, 3, 4, 5];
  const sum = data.reduce((a, b) => a + b, 0);
  console.log("Sum:", sum);
`);
// Output: Sum: 15

// Cell 2: Variables persist!
await client.execute(`
  console.log("Data from Cell 1:", data);
  const doubled = data.map(n => n * 2);
`);
// Output: Data from Cell 1: [1, 2, 3, 4, 5]

// Get completions
client.complete('data.', 5);
// → [{ label: 'map', type: 'method' }, { label: 'filter', ... }, ...]

// Get hover info
client.hover('sum', 0);
// → { found: true, name: 'sum', type: 'number', value: '15' }

// List all variables
client.variables();
// → [{ name: 'data', type: 'array', value: '[5 items]' }, ...]
```

### Multi-Scope Runtime

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime();

// Create isolated scopes
const dataScope = runtime.scope('data-processing');
const vizScope = runtime.scope('visualization');

// Each scope has its own variables
await dataScope.execute('const x = 100');
await vizScope.execute('const x = 200');

dataScope.getVariable('x'); // 100
vizScope.getVariable('x');  // 200 - completely isolated!
```

---

## Core Concepts

### Scopes

A **scope** is an isolated JavaScript execution environment. Variables defined in one scope are not visible in another.

```
┌─────────────────────────────────────────────────────────────────┐
│                        JavaScriptRuntime                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Default Scope  │    scope-A      │         scope-B             │
│  (hidden iframe)│  (hidden iframe)│      (hidden iframe)        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ const x = 1     │ const x = 100   │ const x = 999               │
│ const y = 2     │ const data = [] │ const user = {}             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Isolated!       │ Isolated!       │ Isolated!                   │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Main Context

The **main context** executes code directly in the host page's `window`, giving access to the page's DOM, variables, and state.

```typescript
// Access the actual page
await runtime.executeInMain(`
  console.log(document.title);           // Real page title
  document.body.style.background = 'red'; // Modifies the page!
`);
```

### Artifacts

An **artifact** is a visible iframe that code can render into. Perfect for visualizations, interactive widgets, or sandboxed UI components.

```typescript
const chart = runtime.createArtifact('my-chart', containerElement);

await chart.execute(`
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  // Draw on canvas...
`);
```

---

## API Reference

### `JavaScriptClient`

The core client for single-scope execution and LSP features.

```typescript
import { JavaScriptClient } from 'mrmd-js';

const client = new JavaScriptClient(options?: ClientOptions);
```

#### Options

```typescript
interface ClientOptions {
  sandbox?: {
    // Execute in main window instead of iframe (dangerous!)
    useMainContext?: boolean;

    // Render iframe into this element (makes it visible)
    targetElement?: HTMLElement;

    // Styles for visible iframe
    iframeStyles?: Partial<CSSStyleDeclaration>;

    // Allow code to access main document
    allowMainDocumentAccess?: boolean;

    // Custom timeout for execution (default: 30000ms)
    timeout?: number;
  };
}
```

#### Execution Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `execute(code)` | Execute code synchronously | `Promise<ExecutionResult>` |
| `executeStreaming(code, onChunk)` | Execute with streaming output | `Promise<ExecutionResult>` |

```typescript
// Basic execution
const result = await client.execute('1 + 2');
console.log(result.result); // 3

// Streaming execution
await client.executeStreaming(
  'for (let i = 0; i < 3; i++) console.log(i)',
  (chunk, accumulated, done) => {
    console.log('Output so far:', accumulated);
  }
);
```

#### LSP Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `complete(code, cursorPos)` | Get completions at cursor | `CompletionResult` |
| `hover(code, cursorPos)` | Get hover info at cursor | `HoverResult` |
| `inspect(path)` | Inspect object by path | `InspectResult` |
| `variables()` | List all variables | `VariableInfo[]` |
| `expandVariable(path)` | Get children of object | `VariableInfo[]` |

```typescript
// Completions
const completions = client.complete('data.fi', 7);
// { items: [{ label: 'filter', type: 'method', ... }, ...], from: 5, to: 7 }

// Hover
const hover = client.hover('myArray', 3);
// { found: true, name: 'myArray', type: 'array', value: '[3 items]' }

// Variables
const vars = client.variables();
// [{ name: 'x', type: 'number', value: '42' }, ...]

// Expand nested object
const children = client.expandVariable('user.profile');
// [{ name: 'name', type: 'string', value: '"Alice"' }, ...]
```

#### Scope Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getScope()` | Get all variables as object | `Record<string, unknown>` |
| `getVariable(name)` | Get specific variable value | `unknown` |
| `hasVariable(name)` | Check if variable exists | `boolean` |
| `reset()` | Clear all variables | `void` |
| `destroy()` | Clean up resources | `void` |

#### Utility Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `isMainContext()` | Check if running in main window | `boolean` |
| `getIframe()` | Get underlying iframe element | `HTMLIFrameElement \| null` |

---

### `JavaScriptRuntime`

Multi-scope runtime manager for complex applications.

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime(options?: SandboxOptions);
```

#### Default Scope Methods

These operate on the default (unnamed) scope:

| Method | Description |
|--------|-------------|
| `execute(code)` | Execute in default scope |
| `executeStreaming(code, onChunk)` | Stream execute in default scope |
| `complete(code, cursorPos)` | Completions from default scope |
| `hover(code, cursorPos)` | Hover from default scope |
| `variables()` | Variables from default scope |
| `reset()` | Reset default scope |

#### Named Scope Methods

| Method | Description |
|--------|-------------|
| `scope(name, options?)` | Get or create named scope |
| `hasScope(name)` | Check if scope exists |
| `listScopes()` | List all scope names |
| `destroyScope(name)` | Destroy a scope |
| `resetScope(name)` | Reset a scope |

```typescript
// Create/get scope
const myScope = runtime.scope('data-analysis');

// Use scope directly
await myScope.execute('const x = 1');
myScope.variables(); // [{ name: 'x', ... }]

// Or use helper methods
runtime.completeInScope('data-analysis', 'x.', 2);
runtime.variablesInScope('data-analysis');

// List all scopes
runtime.listScopes(); // ['data-analysis', 'visualization', ...]

// See all variables across all scopes
runtime.allVariables();
// Map { 'default' => [...], 'data-analysis' => [...] }
```

#### Main Context Methods

| Method | Description |
|--------|-------------|
| `executeInMain(code)` | Execute in host page's window |
| `getMainClient()` | Get the main context client |

```typescript
// Execute in actual page
await runtime.executeInMain('alert("Hello from mrmd-js!")');

// Access main client for LSP
const mainClient = runtime.getMainClient();
mainClient.complete('document.query', 14);
```

#### Artifact Methods

| Method | Description |
|--------|-------------|
| `createArtifact(name, element, options?)` | Create visible artifact |
| `getArtifact(name)` | Get existing artifact |

```typescript
// Create visible artifact
const viz = runtime.createArtifact('chart', document.getElementById('chart-container'), {
  styles: { width: '100%', height: '400px', border: '1px solid #ccc' }
});

// Render into it
await viz.execute(`
  document.body.innerHTML = '<h1>My Visualization</h1>';
`);

// Get existing artifact
const existingViz = runtime.getArtifact('chart');
```

#### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `destroy()` | Destroy all scopes and clean up |
| `resetAll()` | Reset all scopes |

---

### `JavaScriptExecutor`

Implements the `Executor` interface for integration with mrmd-editor.

```typescript
import { JavaScriptExecutor } from 'mrmd-js';

const executor = new JavaScriptExecutor();

// Check language support
executor.supports('javascript'); // true
executor.supports('js');         // true
executor.supports('typescript'); // true (runs as JS)

// Execute
const result = await executor.execute('console.log("hi")', 'javascript');

// Access underlying client
const client = executor.getClient();
```

---

## Types

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;           // Did execution complete without error?
  stdout: string;             // Captured console.log output
  stderr: string;             // Captured console.error/warn output
  result?: unknown;           // Return value of last expression
  resultString?: string;      // String representation of result
  error?: ExecutionError;     // Error details if failed
  duration?: number;          // Execution time in milliseconds
  displayData?: DisplayData[]; // Rich display outputs
}

interface ExecutionError {
  name: string;    // Error type (e.g., 'TypeError')
  message: string; // Error message
  stack?: string;  // Stack trace
}
```

### CompletionResult

```typescript
interface CompletionResult {
  items: CompletionItem[];  // Completion suggestions
  from: number;             // Start of text to replace
  to: number;               // End of text to replace
}

interface CompletionItem {
  label: string;           // Text to insert
  type?: string;           // 'variable' | 'method' | 'property' | 'keyword' | 'class' | 'function'
  detail?: string;         // Additional info (e.g., value preview)
  documentation?: string;  // Full documentation
}
```

### HoverResult

```typescript
interface HoverResult {
  found: boolean;      // Was anything found at position?
  name: string;        // Variable/property name
  type: string;        // Type (e.g., 'number', 'array', 'function')
  value?: string;      // Current value as string
  signature?: string;  // Function signature if applicable
}
```

### VariableInfo

```typescript
interface VariableInfo {
  name: string;        // Variable name
  type: string;        // Type
  value: string;       // Value preview
  size?: string;       // Size info (e.g., '5 items' for arrays)
  expandable?: boolean; // Has children to expand?
}
```

---

## Examples

### Example 1: Data Analysis Notebook

```typescript
import { JavaScriptClient } from 'mrmd-js';

const client = new JavaScriptClient();

// Cell 1: Load data
await client.execute(`
  const sales = [
    { month: 'Jan', revenue: 1200 },
    { month: 'Feb', revenue: 1800 },
    { month: 'Mar', revenue: 2400 },
  ];
`);

// Cell 2: Analysis
await client.execute(`
  const total = sales.reduce((sum, s) => sum + s.revenue, 0);
  const average = total / sales.length;
  console.log('Total Revenue:', total);
  console.log('Average:', average.toFixed(2));
`);
// Output:
// Total Revenue: 5400
// Average: 1800.00

// Cell 3: Variables persist
const vars = client.variables();
console.log(vars);
// [
//   { name: 'sales', type: 'array', value: '[3 items]' },
//   { name: 'total', type: 'number', value: '5400' },
//   { name: 'average', type: 'number', value: '1800' }
// ]
```

### Example 2: Multiple Isolated Scopes

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime();

// Data team's scope
const dataScope = runtime.scope('data-team');
await dataScope.execute(`
  const API_KEY = 'data-team-secret-key';
  const fetchData = async () => { /* ... */ };
`);

// Frontend team's scope - cannot see data team's variables
const frontendScope = runtime.scope('frontend-team');
await frontendScope.execute(`
  // API_KEY is not defined here!
  const API_KEY = 'frontend-public-key';
  const renderUI = () => { /* ... */ };
`);

// Each scope has its own API_KEY
dataScope.getVariable('API_KEY');     // 'data-team-secret-key'
frontendScope.getVariable('API_KEY'); // 'frontend-public-key'
```

### Example 3: Interactive Visualization Artifact

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime();

// Create visible artifact
const chartContainer = document.getElementById('chart');
const chart = runtime.createArtifact('sales-chart', chartContainer, {
  styles: { width: '100%', height: '300px' }
});

// Render a chart
await chart.execute(`
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 200;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Draw bars
  const data = [120, 180, 240, 200, 280];
  const barWidth = 60;

  data.forEach((value, i) => {
    const height = value / 300 * 180;
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(i * (barWidth + 10) + 20, 180 - height, barWidth, height);
  });
`);
```

### Example 4: Page Automation with Main Context

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime();

// Read page state
const result = await runtime.executeInMain(`
  ({
    title: document.title,
    url: location.href,
    buttonCount: document.querySelectorAll('button').length
  })
`);
console.log(result.result);
// { title: 'My App', url: 'https://...', buttonCount: 5 }

// Modify the page
await runtime.executeInMain(`
  const header = document.querySelector('h1');
  if (header) {
    header.style.color = 'red';
    header.textContent = 'Modified by mrmd-js!';
  }
`);
```

### Example 5: Building a Variable Explorer

```typescript
import { JavaScriptClient } from 'mrmd-js';

const client = new JavaScriptClient();

// Execute some code
await client.execute(`
  const user = {
    name: 'Alice',
    profile: {
      email: 'alice@example.com',
      settings: { theme: 'dark', notifications: true }
    }
  };
`);

// Build tree view
function renderVariables(vars: VariableInfo[], path = '') {
  return vars.map(v => {
    const fullPath = path ? `${path}.${v.name}` : v.name;
    let html = `<div>${v.name}: ${v.type} = ${v.value}</div>`;

    if (v.expandable) {
      const children = client.expandVariable(fullPath);
      html += `<div style="margin-left: 20px">${renderVariables(children, fullPath)}</div>`;
    }

    return html;
  }).join('');
}

const html = renderVariables(client.variables());
// Renders:
// user: object = {...}
//   name: string = "Alice"
//   profile: object = {...}
//     email: string = "alice@example.com"
//     settings: object = {...}
//       theme: string = "dark"
//       notifications: boolean = true
```

### Example 6: Top-Level Await

```typescript
const client = new JavaScriptClient();

// Async code works at top level
await client.execute(`
  // Fetch data
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();

  // Process with delay
  await new Promise(r => setTimeout(r, 1000));

  console.log('Data loaded:', data.length, 'items');
`);
```

### Example 7: Streaming Output

```typescript
const client = new JavaScriptClient();

const output: string[] = [];

await client.executeStreaming(
  `
  for (let i = 1; i <= 5; i++) {
    console.log('Processing item', i);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Done!');
  `,
  (chunk, accumulated, done) => {
    // Update UI with each chunk
    output.push(chunk);
    updateProgressUI(accumulated, done);
  }
);
```

### Example 8: Cross-Scope Variable Explorer

```typescript
import { JavaScriptRuntime } from 'mrmd-js';

const runtime = new JavaScriptRuntime();

// Setup multiple scopes
await runtime.execute('const defaultVar = 1');
await runtime.scope('analysis').execute('const analysisVar = 2');
await runtime.scope('viz').execute('const vizVar = 3');

// Get all variables across all scopes
const allVars = runtime.allVariables();

// Render grouped by scope
for (const [scopeName, vars] of allVars) {
  console.log(`\n=== ${scopeName} ===`);
  vars.forEach(v => console.log(`  ${v.name}: ${v.value}`));
}

// Output:
// === default ===
//   defaultVar: 1
// === analysis ===
//   analysisVar: 2
// === viz ===
//   vizVar: 3
```

---

## How It Works

### Iframe Sandbox

Code executes in a hidden `<iframe>` with sandbox permissions:

```
┌─────────────────────────────────────────┐
│              Main Page                   │
│  ┌───────────────────────────────────┐  │
│  │  <iframe sandbox="allow-scripts   │  │
│  │           allow-same-origin">     │  │
│  │                                   │  │
│  │    Your code runs here            │  │
│  │    - Isolated global scope        │  │
│  │    - Full browser APIs            │  │
│  │    - Can't access parent          │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Variable Persistence

Top-level declarations are transformed to assignments:

```javascript
// Your code
const x = 1;
let y = 2;
function greet() { return 'hi'; }

// Transformed (top-level only)
x = 1;
y = 2;
greet = function() { return 'hi'; }
```

This makes variables persist in the iframe's global scope.

### Async Support

Code is wrapped in an async IIFE:

```javascript
// Your code
const data = await fetch('/api');
console.log(data);

// Executed as
(async () => {
  data = await fetch('/api');
  console.log(data);
})()
```

### Runtime Completions

Unlike static analysis, completions come from **actual runtime values**:

```javascript
const obj = { foo: 1, bar: 2 };
// Typing "obj." shows: foo, bar, plus Object.prototype methods

const arr = [1, 2, 3];
// Typing "arr." shows: Array methods with actual array context
```

---

## Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| **Infinite loops** | No automatic termination | Use timeout option |
| **TypeScript** | Runs as JavaScript, no type checking | Use external TS compiler |
| **ES Modules** | `import` statements don't work | Use dynamic `import()` |
| **Complex destructuring** | Some patterns may not persist | Use simple assignments |
| **Cross-scope access** | Scopes are fully isolated | Use main context for sharing |
| **No source maps** | Errors show transformed code | Line numbers may be off |

---

## Test Application

A test playground is included:

```bash
# Build and run test app
npm run demo

# Or manually
npm run build
npm run serve
# Open http://localhost:3000
```

The test app demonstrates:
- Basic execution with variable persistence
- Multiple isolated scopes
- Main context page access
- Visible artifact rendering

---

## License

MIT
