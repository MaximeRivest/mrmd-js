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
export function transformForPersistence(code: string): string {
  const lines = code.split('\n');
  const transformed: string[] = [];

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
    if (
      inMultiLineComment ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
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
    } else {
      transformed.push(line);
    }

    braceDepth += openBraces - closeBraces;
    if (braceDepth < 0) braceDepth = 0; // Safety check
  }

  return transformed.join('\n');
}

/**
 * Transform a single line of code
 */
function transformLine(line: string): string {
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
    return line.replace(
      /^(\s*)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
      `$1$2 = function $2(`
    );
  }

  // Match class declarations: class Foo {}
  const classMatch = line.match(/^(\s*)class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);

  if (classMatch) {
    // Convert: class Foo  ->  Foo = class Foo
    return line.replace(
      /^(\s*)class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
      `$1$2 = class $2`
    );
  }

  return line;
}

/**
 * Wrap code in async IIFE for top-level await support
 *
 * @param code - The code to wrap
 * @returns Code wrapped in (async () => { ... })()
 */
export function wrapForAsync(code: string): string {
  return `(async () => {\n${code}\n})()`;
}

/**
 * Extract variable names that would be declared by the code
 * Used for tracking user-defined variables
 *
 * @param code - The original (non-transformed) code
 * @returns Set of variable names
 */
export function extractDeclaredVariables(code: string): Set<string> {
  const variables = new Set<string>();

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
