/**
 * Persistence Transform
 *
 * Transforms const/let declarations to var for persistence across executions.
 * In a REPL, we want variables to persist between cells. const/let are
 * block-scoped and would be lost; var attaches to the global scope.
 *
 * @module transform/persistence
 */

/**
 * Transform const/let declarations to var for persistence.
 *
 * @param {string} code - Source code
 * @returns {string} Transformed code
 *
 * @example
 * transformForPersistence('const x = 1; let y = 2;')
 * // Returns: 'var x = 1; var y = 2;'
 */
export function transformForPersistence(code) {
  // Use a state machine approach to avoid transforming inside strings/comments
  let result = '';
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Check for single-line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      result += code.slice(start, i);
      continue;
    }

    // Check for multi-line comment
    if (code[i] === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      result += code.slice(start, i);
      continue;
    }

    // Check for template literal
    if (code[i] === '`') {
      const start = i;
      i++;
      while (i < len) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === '`') {
          i++;
          break;
        }
        // Handle ${...} - need to track nested braces
        if (code[i] === '$' && code[i + 1] === '{') {
          i += 2;
          let braceDepth = 1;
          while (i < len && braceDepth > 0) {
            if (code[i] === '{') braceDepth++;
            else if (code[i] === '}') braceDepth--;
            i++;
          }
          continue;
        }
        i++;
      }
      result += code.slice(start, i);
      continue;
    }

    // Check for string (single or double quote)
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      const start = i;
      i++;
      while (i < len) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += code.slice(start, i);
      continue;
    }

    // Check for regex (simple heuristic)
    if (code[i] === '/' && i > 0) {
      const prev = code[i - 1];
      // Regex can follow: ( = : [ ! & | ? { } ; , \n
      if ('(=:[!&|?{};,\n'.includes(prev) || /\s/.test(prev)) {
        const start = i;
        i++;
        while (i < len) {
          if (code[i] === '\\') {
            i += 2;
            continue;
          }
          if (code[i] === '/') {
            i++;
            // Skip flags
            while (i < len && /[gimsuy]/.test(code[i])) i++;
            break;
          }
          if (code[i] === '\n') break; // Invalid regex
          i++;
        }
        result += code.slice(start, i);
        continue;
      }
    }

    // Check for const/let keywords
    if (isWordBoundary(code, i)) {
      if (code.slice(i, i + 5) === 'const' && isWordBoundary(code, i + 5)) {
        result += 'var';
        i += 5;
        continue;
      }
      if (code.slice(i, i + 3) === 'let' && isWordBoundary(code, i + 3)) {
        result += 'var';
        i += 3;
        continue;
      }
    }

    result += code[i];
    i++;
  }

  return result;
}

/**
 * Check if position is at a word boundary
 * @param {string} code
 * @param {number} pos
 * @returns {boolean}
 */
function isWordBoundary(code, pos) {
  if (pos === 0) return true;
  if (pos >= code.length) return true;

  const before = code[pos - 1];
  const after = code[pos];

  const isWordChar = (c) => /[a-zA-Z0-9_$]/.test(c);

  // Boundary if previous char is not a word char
  if (pos > 0 && isWordChar(before)) return false;
  // Or if position is at end and next char is not word char
  if (pos < code.length && !isWordChar(after)) return true;

  return true;
}

/**
 * Check if position after keyword is a word boundary
 * @param {string} code
 * @param {number} pos - Position after the keyword
 * @returns {boolean}
 */
function isWordBoundaryAfter(code, pos) {
  if (pos >= code.length) return true;
  return !/[a-zA-Z0-9_$]/.test(code[pos]);
}
