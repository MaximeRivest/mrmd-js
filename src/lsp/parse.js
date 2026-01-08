/**
 * Code Parsing Utilities
 *
 * Utilities for parsing JavaScript code to extract identifiers,
 * determine completion context, and find symbol boundaries.
 *
 * @module lsp/parse
 */

/**
 * @typedef {Object} IdentifierInfo
 * @property {string} name - The identifier name
 * @property {string} full - Full path (e.g., "obj.prop" or "arr[0]")
 * @property {number} start - Start position in code
 * @property {number} end - End position in code
 */

/**
 * @typedef {'member' | 'global' | 'bracket' | 'string' | 'comment' | 'none'} CompletionContextType
 */

/**
 * @typedef {Object} CompletionContext
 * @property {CompletionContextType} type - Context type
 * @property {string} prefix - What user has typed
 * @property {string} [object] - Object path for member access
 * @property {number} start - Start of completion region
 * @property {number} end - End of completion region
 */

// Characters that can be part of an identifier
const ID_START = /[$_a-zA-Z]/;
const ID_CONTINUE = /[$_a-zA-Z0-9]/;

// JavaScript keywords
const KEYWORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'null', 'return', 'static',
  'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'undefined', 'var', 'void', 'while', 'with', 'yield',
  // Future reserved
  'implements', 'interface', 'package', 'private', 'protected', 'public',
]);

// Common globals to suggest
const COMMON_GLOBALS = [
  'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Map',
  'Math', 'Number', 'Object', 'Promise', 'Proxy', 'Reflect', 'RegExp',
  'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet',
  'console', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout',
  'clearInterval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
];

/**
 * Check if a character is an identifier start
 * @param {string} char
 * @returns {boolean}
 */
export function isIdentifierStart(char) {
  return ID_START.test(char);
}

/**
 * Check if a character is an identifier continuation
 * @param {string} char
 * @returns {boolean}
 */
export function isIdentifierPart(char) {
  return ID_CONTINUE.test(char);
}

/**
 * Check if a string is a JavaScript keyword
 * @param {string} str
 * @returns {boolean}
 */
export function isKeyword(str) {
  return KEYWORDS.has(str);
}

/**
 * Get all JavaScript keywords
 * @returns {string[]}
 */
export function getKeywords() {
  return Array.from(KEYWORDS);
}

/**
 * Get common global names
 * @returns {string[]}
 */
export function getCommonGlobals() {
  return COMMON_GLOBALS;
}

/**
 * Find the identifier at a given position in code
 * @param {string} code
 * @param {number} cursor - Cursor position (0-indexed)
 * @returns {IdentifierInfo | null}
 */
export function parseIdentifierAtPosition(code, cursor) {
  if (!code || cursor < 0 || cursor > code.length) {
    return null;
  }

  // Find the start of the identifier chain (handles obj.prop.sub)
  let start = cursor;
  let parenDepth = 0;
  let bracketDepth = 0;

  // Walk backwards to find the start
  while (start > 0) {
    const char = code[start - 1];

    // Handle brackets for array access
    if (char === ']') {
      bracketDepth++;
      start--;
      continue;
    }
    if (char === '[') {
      if (bracketDepth > 0) {
        bracketDepth--;
        start--;
        continue;
      }
      break;
    }

    // Skip over bracket contents
    if (bracketDepth > 0) {
      start--;
      continue;
    }

    // Handle dots for member access
    if (char === '.') {
      start--;
      continue;
    }

    // Handle identifier characters
    if (isIdentifierPart(char)) {
      start--;
      continue;
    }

    // Handle closing paren (for function calls like foo().bar)
    if (char === ')') {
      parenDepth++;
      start--;
      continue;
    }
    if (char === '(') {
      if (parenDepth > 0) {
        parenDepth--;
        start--;
        continue;
      }
      break;
    }

    // Skip over paren contents
    if (parenDepth > 0) {
      start--;
      continue;
    }

    // Stop at any other character
    break;
  }

  // Find the end of the identifier
  let end = cursor;
  while (end < code.length && isIdentifierPart(code[end])) {
    end++;
  }

  if (start === end) {
    return null;
  }

  const full = code.slice(start, end);

  // Extract just the last identifier name
  const lastDot = full.lastIndexOf('.');
  const name = lastDot >= 0 ? full.slice(lastDot + 1) : full;

  return {
    name,
    full,
    start,
    end,
  };
}

/**
 * Determine the completion context at cursor position
 * @param {string} code
 * @param {number} cursor
 * @returns {CompletionContext}
 */
export function parseCompletionContext(code, cursor) {
  // Default result
  const defaultResult = {
    type: /** @type {CompletionContextType} */ ('none'),
    prefix: '',
    start: cursor,
    end: cursor,
  };

  if (!code || cursor < 0 || cursor > code.length) {
    return defaultResult;
  }

  // Check if we're in a string or comment
  const contextType = getStringOrCommentContext(code, cursor);
  if (contextType === 'string' || contextType === 'comment') {
    return { type: contextType, prefix: '', start: cursor, end: cursor };
  }

  // Find what's immediately before the cursor
  let pos = cursor - 1;

  // Skip whitespace
  while (pos >= 0 && /\s/.test(code[pos])) {
    pos--;
  }

  if (pos < 0) {
    return { type: 'global', prefix: '', start: cursor, end: cursor };
  }

  // Check for member access (dot notation)
  if (code[pos] === '.') {
    // Find the object before the dot
    const objectEnd = pos;
    const objectInfo = parseIdentifierAtPosition(code, objectEnd);

    if (objectInfo) {
      return {
        type: 'member',
        prefix: '',
        object: objectInfo.full,
        start: cursor,
        end: cursor,
      };
    }

    return { type: 'member', prefix: '', object: '', start: cursor, end: cursor };
  }

  // Check if we're typing an identifier
  if (isIdentifierPart(code[pos])) {
    // Walk back to find the start
    let start = pos;
    while (start > 0 && isIdentifierPart(code[start - 1])) {
      start--;
    }

    const prefix = code.slice(start, cursor);

    // Check what's before this identifier
    let beforeStart = start - 1;
    while (beforeStart >= 0 && /\s/.test(code[beforeStart])) {
      beforeStart--;
    }

    if (beforeStart >= 0 && code[beforeStart] === '.') {
      // Member access with partial identifier
      const objectEnd = beforeStart;
      const objectInfo = parseIdentifierAtPosition(code, objectEnd);

      return {
        type: 'member',
        prefix,
        object: objectInfo?.full ?? '',
        start,
        end: cursor,
      };
    }

    // Global identifier
    return {
      type: 'global',
      prefix,
      start,
      end: cursor,
    };
  }

  // Check for bracket access
  if (code[pos] === '[') {
    // Find the object before the bracket
    const objectEnd = pos;
    const objectInfo = parseIdentifierAtPosition(code, objectEnd);

    if (objectInfo) {
      return {
        type: 'bracket',
        prefix: '',
        object: objectInfo.full,
        start: cursor,
        end: cursor,
      };
    }
  }

  return { type: 'global', prefix: '', start: cursor, end: cursor };
}

/**
 * Determine if cursor is inside a string or comment
 * @param {string} code
 * @param {number} cursor
 * @returns {'string' | 'comment' | null}
 */
export function getStringOrCommentContext(code, cursor) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < cursor && i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];
    const prev = code[i - 1];

    // Skip escaped characters in strings
    if ((inSingleQuote || inDoubleQuote || inTemplate) && prev === '\\') {
      continue;
    }

    // Line comment
    if (!inSingleQuote && !inDoubleQuote && !inTemplate && !inBlockComment) {
      if (char === '/' && next === '/') {
        inLineComment = true;
        i++; // Skip next char
        continue;
      }
    }

    // Block comment
    if (!inSingleQuote && !inDoubleQuote && !inTemplate && !inLineComment) {
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (inBlockComment && char === '*' && next === '/') {
        inBlockComment = false;
        i++;
        continue;
      }
    }

    // End line comment at newline
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }

    // Strings
    if (!inLineComment && !inBlockComment) {
      if (char === "'" && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
        continue;
      }
    }
  }

  if (inSingleQuote || inDoubleQuote || inTemplate) {
    return 'string';
  }
  if (inLineComment || inBlockComment) {
    return 'comment';
  }
  return null;
}

/**
 * Extract the word at cursor position (simpler than full identifier)
 * @param {string} code
 * @param {number} cursor
 * @returns {{word: string, start: number, end: number}}
 */
export function getWordAtCursor(code, cursor) {
  let start = cursor;
  let end = cursor;

  // Walk backwards
  while (start > 0 && isIdentifierPart(code[start - 1])) {
    start--;
  }

  // Walk forwards
  while (end < code.length && isIdentifierPart(code[end])) {
    end++;
  }

  return {
    word: code.slice(start, end),
    start,
    end,
  };
}

/**
 * Split an object path into parts
 * e.g., "obj.prop[0].name" → ["obj", "prop", "0", "name"]
 * @param {string} path
 * @returns {string[]}
 */
export function splitObjectPath(path) {
  const parts = [];
  let current = '';
  let inBracket = false;

  for (const char of path) {
    if (char === '.' && !inBracket) {
      if (current) parts.push(current);
      current = '';
    } else if (char === '[') {
      if (current) parts.push(current);
      current = '';
      inBracket = true;
    } else if (char === ']') {
      if (current) parts.push(current);
      current = '';
      inBracket = false;
    } else if (char === '"' || char === "'") {
      // Skip quotes in bracket notation
      continue;
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}
