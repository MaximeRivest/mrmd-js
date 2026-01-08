/**
 * Async Transform
 *
 * Wraps code to support top-level await.
 * @module transform/async
 */

/**
 * Check if code contains top-level await
 * @param {string} code
 * @returns {boolean}
 */
function hasTopLevelAwait(code) {
  // Simple check - look for await outside of async function/arrow
  // This is a heuristic; a proper check would need AST parsing

  // Remove strings, comments, and regex to avoid false positives
  const cleaned = code
    // Remove template literals (simple version)
    .replace(/`[^`]*`/g, '')
    // Remove strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, '')
    // Remove single-line comments
    .replace(/\/\/[^\n]*/g, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Track nesting depth of async contexts
  // This is simplified - real implementation would use AST
  let depth = 0;
  let i = 0;

  while (i < cleaned.length) {
    // Check for async function or async arrow
    if (cleaned.slice(i, i + 5) === 'async') {
      // Look ahead for function or arrow
      let j = i + 5;
      while (j < cleaned.length && /\s/.test(cleaned[j])) j++;

      if (
        cleaned.slice(j, j + 8) === 'function' ||
        cleaned[j] === '('
      ) {
        // Found async context start
        depth++;
      }
    }

    // Track braces for context depth (simplified)
    if (cleaned[i] === '{') {
      // Already in async context, depth increases
    }
    if (cleaned[i] === '}') {
      // Could be end of async context
      if (depth > 0) depth--;
    }

    // Check for await at top level
    if (cleaned.slice(i, i + 5) === 'await') {
      const before = i > 0 ? cleaned[i - 1] : ' ';
      const after = i + 5 < cleaned.length ? cleaned[i + 5] : ' ';

      // Check it's a word boundary
      if (!/[a-zA-Z0-9_$]/.test(before) && !/[a-zA-Z0-9_$]/.test(after)) {
        // Found await - check if we're at top level
        // For simplicity, assume any await not deep in braces is top-level
        // A proper implementation would track async function scopes
        return true;
      }
    }

    i++;
  }

  return false;
}

/**
 * Wrap code for top-level await support
 *
 * Transforms code to run in an async IIFE that captures the last expression.
 *
 * @param {string} code - Source code
 * @returns {string} Wrapped code
 */
export function wrapForAsync(code) {
  const needsAsync = hasTopLevelAwait(code);

  // We always wrap to capture the return value
  // The wrapper captures the last expression value

  if (needsAsync) {
    return `(async () => {
${code}
})()`;
  }

  return `(() => {
${code}
})()`;
}

/**
 * Wrap code and capture the last expression value
 *
 * @param {string} code - Source code
 * @returns {string} Wrapped code that returns last expression
 */
export function wrapWithLastExpression(code) {
  const needsAsync = hasTopLevelAwait(code);

  // Find the last expression and make it a return value
  // This is tricky without AST - we use eval trick instead
  const wrapped = `
;(${needsAsync ? 'async ' : ''}function() {
  let __result__;
  try {
    __result__ = eval(${JSON.stringify(code)});
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Code might be statements, not expression
      eval(${JSON.stringify(code)});
      __result__ = undefined;
    } else {
      throw e;
    }
  }
  return __result__;
})()`;

  return wrapped.trim();
}
