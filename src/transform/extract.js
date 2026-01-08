/**
 * Extract Transform
 *
 * Extracts declared variable names from code.
 * @module transform/extract
 */

/**
 * Extract all variable names that will be declared by the code.
 * Handles var, let, const, function, and class declarations.
 *
 * @param {string} code - Source code
 * @returns {string[]} Array of declared variable names
 *
 * @example
 * extractDeclaredVariables('const x = 1; let { a, b } = obj; function foo() {}')
 * // Returns: ['x', 'a', 'b', 'foo']
 */
export function extractDeclaredVariables(code) {
  const variables = new Set();

  // Remove strings, comments to avoid false matches
  const cleaned = removeStringsAndComments(code);

  // Match var/let/const declarations
  // Handles: const x = 1, let x = 1, var x = 1
  // Handles: const { a, b } = obj, const [a, b] = arr
  const varPattern = /\b(?:var|let|const)\s+([^=;]+?)(?:\s*=|\s*;|\s*$)/g;

  let match;
  while ((match = varPattern.exec(cleaned)) !== null) {
    const declaration = match[1].trim();
    extractNamesFromPattern(declaration, variables);
  }

  // Match function declarations
  const funcPattern = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((match = funcPattern.exec(cleaned)) !== null) {
    variables.add(match[1]);
  }

  // Match class declarations
  const classPattern = /\bclass\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((match = classPattern.exec(cleaned)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Extract variable names from a destructuring pattern or simple identifier
 * @param {string} pattern
 * @param {Set<string>} variables
 */
function extractNamesFromPattern(pattern, variables) {
  // Simple identifier
  const simpleMatch = pattern.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
  if (simpleMatch) {
    variables.add(simpleMatch[1]);
    return;
  }

  // Object destructuring { a, b: c, ...rest }
  if (pattern.startsWith('{')) {
    const inner = pattern.slice(1, -1);
    // Split by comma, handling nested braces
    const parts = splitByComma(inner);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle rest: ...rest
      if (trimmed.startsWith('...')) {
        const name = trimmed.slice(3).trim();
        if (isValidIdentifier(name)) {
          variables.add(name);
        }
        continue;
      }

      // Handle rename: key: name or key: pattern
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const value = trimmed.slice(colonIdx + 1).trim();
        extractNamesFromPattern(value, variables);
      } else {
        // Simple: key (which is also the variable name)
        const name = trimmed.split('=')[0].trim(); // Handle default values
        if (isValidIdentifier(name)) {
          variables.add(name);
        }
      }
    }
    return;
  }

  // Array destructuring [a, b, ...rest]
  if (pattern.startsWith('[')) {
    const inner = pattern.slice(1, -1);
    const parts = splitByComma(inner);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle rest: ...rest
      if (trimmed.startsWith('...')) {
        const name = trimmed.slice(3).trim();
        if (isValidIdentifier(name)) {
          variables.add(name);
        }
        continue;
      }

      // Handle nested destructuring or simple name
      const nameOrPattern = trimmed.split('=')[0].trim();
      extractNamesFromPattern(nameOrPattern, variables);
    }
    return;
  }

  // Multiple declarations: a, b, c (from var a, b, c)
  if (pattern.includes(',')) {
    const parts = splitByComma(pattern);
    for (const part of parts) {
      const trimmed = part.trim().split('=')[0].trim();
      if (isValidIdentifier(trimmed)) {
        variables.add(trimmed);
      }
    }
  }
}

/**
 * Split string by commas, respecting nested brackets
 * @param {string} str
 * @returns {string[]}
 */
function splitByComma(str) {
  const parts = [];
  let current = '';
  let depth = 0;

  for (const char of str) {
    if ((char === '{' || char === '[' || char === '(')) {
      depth++;
      current += char;
    } else if ((char === '}' || char === ']' || char === ')')) {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Check if string is a valid JavaScript identifier
 * @param {string} name
 * @returns {boolean}
 */
function isValidIdentifier(name) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Remove strings and comments from code
 * @param {string} code
 * @returns {string}
 */
function removeStringsAndComments(code) {
  let result = '';
  let i = 0;

  while (i < code.length) {
    // Single-line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    // Multi-line comment
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Template literal
    if (code[i] === '`') {
      result += ' ';
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === '`') {
          i++;
          break;
        }
        if (code[i] === '$' && code[i + 1] === '{') {
          i += 2;
          let depth = 1;
          while (i < code.length && depth > 0) {
            if (code[i] === '{') depth++;
            else if (code[i] === '}') depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }

    // String
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      result += ' ';
      i++;
      while (i < code.length) {
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
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}
