/**
 * Statement Completeness Checker
 *
 * Determines whether a piece of code is a complete statement that can
 * be executed, or if it needs more input (like an unclosed bracket).
 *
 * @module analysis/is-complete
 */

/**
 * @typedef {import('../types/analysis.js').IsCompleteResult} IsCompleteResult
 */

/**
 * Check if code is a complete statement
 *
 * @param {string} code - The code to check
 * @returns {IsCompleteResult}
 */
export function isComplete(code) {
  const trimmed = code.trim();

  // Empty code is complete
  if (!trimmed) {
    return { status: 'complete', indent: '' };
  }

  // Check bracket balance
  const bracketInfo = checkBrackets(trimmed);
  if (bracketInfo.unclosed > 0) {
    return {
      status: 'incomplete',
      indent: '  '.repeat(bracketInfo.unclosed),
    };
  }
  if (bracketInfo.unclosed < 0) {
    return { status: 'invalid', indent: '' };
  }

  // Check for unterminated strings
  const stringInfo = checkStrings(trimmed);
  if (stringInfo.unclosed) {
    return { status: 'incomplete', indent: '' };
  }

  // Check for trailing operators that suggest continuation
  if (endsWithContinuation(trimmed)) {
    return { status: 'incomplete', indent: '' };
  }

  // Check for incomplete template literals
  if (hasIncompleteTemplate(trimmed)) {
    return { status: 'incomplete', indent: '' };
  }

  // Try to parse to verify syntax
  const parseResult = tryParse(code);
  return parseResult;
}

/**
 * Check bracket balance
 * @param {string} code
 * @returns {{ unclosed: number }}
 */
function checkBrackets(code) {
  let depth = 0;
  let inString = null;
  let inTemplate = false;
  let templateDepth = 0;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prev = code[i - 1];
    const next = code[i + 1];

    // Handle escape sequences in strings
    if ((inString || inTemplate) && prev === '\\') {
      continue;
    }

    // Handle comments
    if (!inString && !inTemplate && !inBlockComment && char === '/' && next === '/') {
      inLineComment = true;
      continue;
    }
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;

    if (!inString && !inTemplate && !inLineComment && char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment && char === '*' && next === '/') {
      inBlockComment = false;
      i++;
      continue;
    }
    if (inBlockComment) continue;

    // Handle strings
    if (!inTemplate && (char === '"' || char === "'")) {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
      continue;
    }

    // Handle template literals
    if (char === '`') {
      if (inTemplate && templateDepth === 0) {
        inTemplate = false;
      } else if (!inString) {
        inTemplate = true;
        templateDepth = 0;
      }
      continue;
    }

    // Handle template expressions ${...}
    if (inTemplate && char === '$' && next === '{') {
      templateDepth++;
      continue;
    }
    if (inTemplate && templateDepth > 0 && char === '}') {
      templateDepth--;
      continue;
    }

    // Skip bracket counting inside strings
    if (inString) continue;
    if (inTemplate && templateDepth === 0) continue;

    // Count brackets
    if (char === '{' || char === '[' || char === '(') {
      depth++;
    } else if (char === '}' || char === ']' || char === ')') {
      depth--;
    }
  }

  return { unclosed: depth };
}

/**
 * Check for unterminated strings
 * @param {string} code
 * @returns {{ unclosed: boolean }}
 */
function checkStrings(code) {
  let inString = null;
  let inTemplate = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prev = code[i - 1];

    // Skip escaped characters
    if (prev === '\\') continue;

    // Skip comments
    if (!inString && !inTemplate && char === '/' && code[i + 1] === '/') {
      // Find end of line
      const newline = code.indexOf('\n', i);
      if (newline === -1) break;
      i = newline;
      continue;
    }

    if (!inString && !inTemplate && char === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    // Track strings
    if (!inTemplate && (char === '"' || char === "'")) {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
      }
    }

    // Track template literals
    if (!inString && char === '`') {
      inTemplate = !inTemplate;
    }
  }

  return { unclosed: inString !== null || inTemplate };
}

/**
 * Check if code ends with a continuation operator
 * @param {string} code
 * @returns {boolean}
 */
function endsWithContinuation(code) {
  // Remove trailing whitespace and comments
  let trimmed = code.trim();

  // Remove trailing line comment
  const lines = trimmed.split('\n');
  let lastLine = lines[lines.length - 1].trim();
  const commentIndex = findLineCommentStart(lastLine);
  if (commentIndex !== -1) {
    lastLine = lastLine.slice(0, commentIndex).trim();
    if (!lastLine) {
      // Line was only a comment, check previous lines
      for (let i = lines.length - 2; i >= 0; i--) {
        lastLine = lines[i].trim();
        const ci = findLineCommentStart(lastLine);
        if (ci !== -1) {
          lastLine = lastLine.slice(0, ci).trim();
        }
        if (lastLine) break;
      }
    }
  }

  if (!lastLine) return false;

  // Operators that suggest continuation
  const continuationOps = [
    '+', '-', '*', '/', '%', '**',
    '=', '+=', '-=', '*=', '/=', '%=',
    '==', '===', '!=', '!==',
    '<', '>', '<=', '>=',
    '&&', '||', '??',
    '&', '|', '^', '~',
    '<<', '>>', '>>>',
    '?', ':',
    ',',
    '.',
    '=>',
  ];

  for (const op of continuationOps) {
    if (lastLine.endsWith(op)) {
      return true;
    }
  }

  // Keywords that suggest continuation
  const continuationKeywords = [
    'return', 'throw', 'new', 'typeof', 'void', 'delete',
    'await', 'yield', 'in', 'of', 'instanceof',
    'else', 'extends', 'implements',
  ];

  for (const kw of continuationKeywords) {
    if (lastLine === kw || lastLine.endsWith(' ' + kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Find line comment start, accounting for strings
 * @param {string} line
 * @returns {number}
 */
function findLineCommentStart(line) {
  let inString = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const prev = line[i - 1];

    if (prev === '\\') continue;

    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = char;
    } else if (inString === char) {
      inString = null;
    } else if (!inString && char === '/' && line[i + 1] === '/') {
      return i;
    }
  }

  return -1;
}

/**
 * Check for incomplete template literal expressions
 * @param {string} code
 * @returns {boolean}
 */
function hasIncompleteTemplate(code) {
  let inTemplate = false;
  let expressionDepth = 0;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prev = code[i - 1];
    const next = code[i + 1];

    if (prev === '\\') continue;

    if (char === '`') {
      if (inTemplate && expressionDepth === 0) {
        inTemplate = false;
      } else if (!inTemplate) {
        inTemplate = true;
        expressionDepth = 0;
      }
    } else if (inTemplate && char === '$' && next === '{') {
      expressionDepth++;
      i++;
    } else if (inTemplate && expressionDepth > 0) {
      if (char === '{') expressionDepth++;
      else if (char === '}') expressionDepth--;
    }
  }

  return inTemplate;
}

/**
 * Try to parse the code to check for syntax errors
 * @param {string} code
 * @returns {IsCompleteResult}
 */
function tryParse(code) {
  try {
    // Try to parse as a function body
    new Function(code);
    return { status: 'complete', indent: '' };
  } catch (e) {
    if (e instanceof SyntaxError) {
      const msg = e.message.toLowerCase();

      // Patterns that indicate incomplete code
      const incompletePatterns = [
        'unexpected end',
        'unterminated',
        'expected',
        'missing',
      ];

      for (const pattern of incompletePatterns) {
        if (msg.includes(pattern)) {
          return { status: 'incomplete', indent: '' };
        }
      }

      // Other syntax errors are invalid
      return { status: 'invalid', indent: '' };
    }

    return { status: 'unknown', indent: '' };
  }
}

/**
 * Get suggested indent for continuation
 * @param {string} code
 * @returns {string}
 */
export function getSuggestedIndent(code) {
  const lines = code.split('\n');
  const lastLine = lines[lines.length - 1];

  // Get current indent
  const match = lastLine.match(/^(\s*)/);
  const currentIndent = match ? match[1] : '';

  // Check if we should increase indent
  const trimmed = lastLine.trim();
  const shouldIncrease =
    trimmed.endsWith('{') ||
    trimmed.endsWith('[') ||
    trimmed.endsWith('(') ||
    trimmed.endsWith(':') ||
    trimmed.endsWith('=>');

  if (shouldIncrease) {
    return currentIndent + '  ';
  }

  return currentIndent;
}
