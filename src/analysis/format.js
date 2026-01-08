/**
 * Code Formatting
 *
 * Formats JavaScript code. Can integrate with prettier if available,
 * otherwise provides basic formatting.
 *
 * @module analysis/format
 */

/**
 * @typedef {import('../types/analysis.js').FormatResult} FormatResult
 */

/**
 * @typedef {Object} FormatOptions
 * @property {number} [tabWidth=2] - Number of spaces per tab
 * @property {boolean} [useTabs=false] - Use tabs instead of spaces
 * @property {boolean} [semi=true] - Add semicolons
 * @property {boolean} [singleQuote=false] - Use single quotes
 * @property {number} [printWidth=80] - Line width
 */

/** @type {any} */
let prettierInstance = null;

/**
 * Set prettier instance for formatting
 * This allows external prettier to be provided
 *
 * @param {any} prettier - Prettier instance
 */
export function setPrettier(prettier) {
  prettierInstance = prettier;
}

/**
 * Check if prettier is available
 * @returns {boolean}
 */
export function hasPrettier() {
  return prettierInstance !== null;
}

/**
 * Format JavaScript code
 *
 * @param {string} code - Code to format
 * @param {FormatOptions} [options]
 * @returns {Promise<FormatResult>}
 */
export async function formatCode(code, options = {}) {
  // Try prettier first
  if (prettierInstance) {
    try {
      const formatted = await formatWithPrettier(code, options);
      return {
        formatted,
        changed: formatted !== code,
      };
    } catch (e) {
      // Prettier failed, fall back to basic formatting
      console.warn('Prettier formatting failed:', e);
    }
  }

  // Fall back to basic formatting
  const formatted = basicFormat(code, options);
  return {
    formatted,
    changed: formatted !== code,
  };
}

/**
 * Format with prettier
 * @param {string} code
 * @param {FormatOptions} options
 * @returns {Promise<string>}
 */
async function formatWithPrettier(code, options) {
  const prettierOptions = {
    parser: 'babel',
    tabWidth: options.tabWidth ?? 2,
    useTabs: options.useTabs ?? false,
    semi: options.semi ?? true,
    singleQuote: options.singleQuote ?? false,
    printWidth: options.printWidth ?? 80,
  };

  // prettier might be async or sync depending on version
  const result = prettierInstance.format(code, prettierOptions);
  return result instanceof Promise ? await result : result;
}

/**
 * Basic code formatting (no external dependencies)
 *
 * @param {string} code
 * @param {FormatOptions} options
 * @returns {string}
 */
export function basicFormat(code, options = {}) {
  const tabWidth = options.tabWidth ?? 2;
  const useTabs = options.useTabs ?? false;
  const semi = options.semi ?? true;
  const indent = useTabs ? '\t' : ' '.repeat(tabWidth);

  let result = code;

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Normalize whitespace around operators
  result = normalizeOperatorSpacing(result);

  // Normalize comma spacing
  result = result.replace(/,\s*/g, ', ');

  // Normalize colon spacing in objects
  result = normalizeColonSpacing(result);

  // Fix indentation
  result = fixIndentation(result, indent);

  // Add/remove trailing semicolons
  if (semi) {
    result = addSemicolons(result);
  }

  // Remove trailing whitespace
  result = result.split('\n').map(line => line.trimEnd()).join('\n');

  // Ensure single trailing newline
  result = result.trimEnd() + '\n';

  return result;
}

/**
 * Normalize spacing around operators
 * @param {string} code
 * @returns {string}
 */
function normalizeOperatorSpacing(code) {
  // This is tricky because we need to handle strings and regex
  // For now, do a simple replacement that might not be perfect

  // Binary operators (add spaces around)
  const binaryOps = [
    '===', '!==', '==', '!=',
    '<=', '>=', '<', '>',
    '&&', '||', '??',
    '+=', '-=', '*=', '/=', '%=',
    '**=', '&=', '|=', '^=',
    '<<=', '>>=', '>>>=',
    '=>',
  ];

  let result = code;

  // Process each operator (order matters - longer first)
  for (const op of binaryOps) {
    const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Only if not already properly spaced
    result = result.replace(
      new RegExp(`(\\S)${escaped}(\\S)`, 'g'),
      `$1 ${op} $2`
    );
  }

  // Single = assignment (but not ==, ===, =>, etc)
  result = result.replace(/(\w)=(?![=>])(\S)/g, '$1 = $2');

  return result;
}

/**
 * Normalize colon spacing in objects
 * @param {string} code
 * @returns {string}
 */
function normalizeColonSpacing(code) {
  // Object property colons: add space after but not before
  // This is imperfect but handles common cases
  return code.replace(/(\w+)\s*:\s*/g, '$1: ');
}

/**
 * Fix indentation based on bracket depth
 * @param {string} code
 * @param {string} indent
 * @returns {string}
 */
function fixIndentation(code, indent) {
  const lines = code.split('\n');
  const result = [];
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      result.push('');
      continue;
    }

    // Check if line starts with closing bracket
    const startsWithClose = /^[}\])]/.test(trimmed);
    if (startsWithClose && depth > 0) {
      depth--;
    }

    // Add indentation
    result.push(indent.repeat(depth) + trimmed);

    // Count bracket changes for next line
    const opens = (trimmed.match(/[{[(]/g) || []).length;
    const closes = (trimmed.match(/[}\])]/g) || []).length;
    depth += opens - closes;

    // Ensure depth doesn't go negative
    if (depth < 0) depth = 0;
  }

  return result.join('\n');
}

/**
 * Add semicolons to statements that need them
 * @param {string} code
 * @returns {string}
 */
function addSemicolons(code) {
  const lines = code.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      result.push(line);
      continue;
    }

    // Skip lines that don't need semicolons
    const skipPatterns = [
      /^\/\//, // Comment
      /^\/\*/, // Block comment start
      /\*\/$/, // Block comment end
      /^\*/, // Block comment middle
      /^import\s/, // Import (might need semi, but complex)
      /^export\s/, // Export
      /^if\s*\(/, // If
      /^else/, // Else
      /^for\s*\(/, // For
      /^while\s*\(/, // While
      /^do\s*{?$/, // Do
      /^switch\s*\(/, // Switch
      /^try\s*{?$/, // Try
      /^catch\s*\(/, // Catch
      /^finally\s*{?$/, // Finally
      /^function\s/, // Function declaration
      /^class\s/, // Class
      /^async\s+function/, // Async function
      /[{,]\s*$/, // Ends with { or ,
      /^\s*[}\])]/, // Starts with closing bracket
    ];

    let needsSemi = true;
    for (const pattern of skipPatterns) {
      if (pattern.test(trimmed)) {
        needsSemi = false;
        break;
      }
    }

    // Already has semicolon
    if (trimmed.endsWith(';')) {
      needsSemi = false;
    }

    // Check if next non-empty line suggests continuation
    if (needsSemi) {
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) continue;
        if (/^[.?[]/.test(nextTrimmed)) {
          // Next line is continuation
          needsSemi = false;
        }
        break;
      }
    }

    if (needsSemi) {
      // Find where to insert semicolon (before trailing comment)
      const commentMatch = line.match(/^(.*?)(\s*\/\/.*)$/);
      if (commentMatch) {
        line = commentMatch[1] + ';' + commentMatch[2];
      } else {
        line = line.trimEnd() + ';';
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Format HTML code (basic)
 * @param {string} code
 * @returns {string}
 */
export function formatHtml(code) {
  // Very basic HTML formatting
  let result = code;

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Add newlines after block elements
  result = result.replace(/(<\/(?:div|p|ul|ol|li|h[1-6]|header|footer|section|article|nav|aside|main|table|tr|thead|tbody|form)>)/gi, '$1\n');

  // Add newlines before block elements
  result = result.replace(/(<(?:div|p|ul|ol|li|h[1-6]|header|footer|section|article|nav|aside|main|table|tr|thead|tbody|form)(?:\s[^>]*)?>)/gi, '\n$1');

  // Remove multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim() + '\n';
}

/**
 * Format CSS code (basic)
 * @param {string} code
 * @returns {string}
 */
export function formatCss(code) {
  let result = code;

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Add newlines after { and ;
  result = result.replace(/\{/g, ' {\n');
  result = result.replace(/;/g, ';\n');
  result = result.replace(/\}/g, '\n}\n');

  // Fix property spacing
  result = result.replace(/:\s*/g, ': ');

  // Fix indentation
  const lines = result.split('\n');
  const formatted = [];
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === '}') depth--;
    formatted.push('  '.repeat(Math.max(0, depth)) + trimmed);
    if (trimmed.endsWith('{')) depth++;
  }

  return formatted.join('\n') + '\n';
}
