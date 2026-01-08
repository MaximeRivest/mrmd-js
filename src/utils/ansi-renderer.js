/**
 * ANSI to HTML Renderer
 *
 * Converts ANSI escape sequences to HTML with appropriate styling.
 * Useful for rendering terminal output from code execution.
 *
 * @module utils/ansi-renderer
 */

/**
 * @typedef {Object} AnsiStyle
 * @property {string} [color] - Foreground color
 * @property {string} [background] - Background color
 * @property {boolean} [bold] - Bold text
 * @property {boolean} [dim] - Dim text
 * @property {boolean} [italic] - Italic text
 * @property {boolean} [underline] - Underlined text
 * @property {boolean} [strikethrough] - Strikethrough text
 * @property {boolean} [inverse] - Inverse colors
 */

/**
 * ANSI color codes to CSS colors
 */
const COLORS = {
  30: '#000000', // Black
  31: '#cc0000', // Red
  32: '#00cc00', // Green
  33: '#cccc00', // Yellow
  34: '#0000cc', // Blue
  35: '#cc00cc', // Magenta
  36: '#00cccc', // Cyan
  37: '#cccccc', // White
  90: '#666666', // Bright Black (Gray)
  91: '#ff0000', // Bright Red
  92: '#00ff00', // Bright Green
  93: '#ffff00', // Bright Yellow
  94: '#0000ff', // Bright Blue
  95: '#ff00ff', // Bright Magenta
  96: '#00ffff', // Bright Cyan
  97: '#ffffff', // Bright White
};

const BG_COLORS = {
  40: '#000000',
  41: '#cc0000',
  42: '#00cc00',
  43: '#cccc00',
  44: '#0000cc',
  45: '#cc00cc',
  46: '#00cccc',
  47: '#cccccc',
  100: '#666666',
  101: '#ff0000',
  102: '#00ff00',
  103: '#ffff00',
  104: '#0000ff',
  105: '#ff00ff',
  106: '#00ffff',
  107: '#ffffff',
};

/**
 * ANSI Renderer class
 */
export class AnsiRenderer {
  /** @type {boolean} */
  #escapeHtml = true;

  /**
   * Create ANSI renderer
   * @param {{ escapeHtml?: boolean }} [options]
   */
  constructor(options = {}) {
    this.#escapeHtml = options.escapeHtml !== false;
  }

  /**
   * Convert ANSI text to HTML
   *
   * @param {string} text - Text with ANSI escape sequences
   * @returns {string} HTML string
   */
  render(text) {
    if (!text) return '';

    /** @type {AnsiStyle} */
    let currentStyle = {};
    const parts = [];
    let currentText = '';

    // ANSI escape sequence regex
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let match;

    while ((match = ansiRegex.exec(text)) !== null) {
      // Add text before this escape sequence
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText) {
        currentText += beforeText;
      }

      // Parse codes
      const codes = match[1].split(';').map(c => parseInt(c, 10) || 0);

      // Flush current text with current style
      if (currentText) {
        parts.push(this.#wrapWithStyle(currentText, currentStyle));
        currentText = '';
      }

      // Update style based on codes
      currentStyle = this.#updateStyle(currentStyle, codes);

      lastIndex = ansiRegex.lastIndex;
    }

    // Add remaining text
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      currentText += remainingText;
    }

    if (currentText) {
      parts.push(this.#wrapWithStyle(currentText, currentStyle));
    }

    return parts.join('');
  }

  /**
   * Render to a DOM element
   *
   * @param {string} text - ANSI text
   * @param {HTMLElement} container - Target container
   * @param {{ clear?: boolean }} [options]
   */
  renderTo(text, container, options = {}) {
    const html = this.render(text);

    if (options.clear !== false) {
      container.innerHTML = '';
    }

    const wrapper = document.createElement('pre');
    wrapper.className = 'ansi-output';
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  }

  /**
   * Update style based on ANSI codes
   * @param {AnsiStyle} style
   * @param {number[]} codes
   * @returns {AnsiStyle}
   */
  #updateStyle(style, codes) {
    const newStyle = { ...style };

    for (const code of codes) {
      if (code === 0) {
        // Reset all
        return {};
      } else if (code === 1) {
        newStyle.bold = true;
      } else if (code === 2) {
        newStyle.dim = true;
      } else if (code === 3) {
        newStyle.italic = true;
      } else if (code === 4) {
        newStyle.underline = true;
      } else if (code === 7) {
        newStyle.inverse = true;
      } else if (code === 9) {
        newStyle.strikethrough = true;
      } else if (code === 22) {
        newStyle.bold = false;
        newStyle.dim = false;
      } else if (code === 23) {
        newStyle.italic = false;
      } else if (code === 24) {
        newStyle.underline = false;
      } else if (code === 27) {
        newStyle.inverse = false;
      } else if (code === 29) {
        newStyle.strikethrough = false;
      } else if (code === 39) {
        delete newStyle.color;
      } else if (code === 49) {
        delete newStyle.background;
      } else if (code >= 30 && code <= 37) {
        newStyle.color = COLORS[code];
      } else if (code >= 40 && code <= 47) {
        newStyle.background = BG_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        newStyle.color = COLORS[code];
      } else if (code >= 100 && code <= 107) {
        newStyle.background = BG_COLORS[code];
      }
      // TODO: 256 color and RGB support (38;5;n and 38;2;r;g;b)
    }

    return newStyle;
  }

  /**
   * Wrap text with style span
   * @param {string} text
   * @param {AnsiStyle} style
   * @returns {string}
   */
  #wrapWithStyle(text, style) {
    // Escape HTML if needed
    let escaped = text;
    if (this.#escapeHtml) {
      escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // No style needed
    if (Object.keys(style).length === 0) {
      return escaped;
    }

    // Build inline style
    const styles = [];

    if (style.color) {
      styles.push(`color:${style.color}`);
    }
    if (style.background) {
      styles.push(`background-color:${style.background}`);
    }
    if (style.bold) {
      styles.push('font-weight:bold');
    }
    if (style.dim) {
      styles.push('opacity:0.5');
    }
    if (style.italic) {
      styles.push('font-style:italic');
    }
    if (style.underline) {
      styles.push('text-decoration:underline');
    }
    if (style.strikethrough) {
      if (style.underline) {
        styles.push('text-decoration:underline line-through');
      } else {
        styles.push('text-decoration:line-through');
      }
    }

    if (styles.length === 0) {
      return escaped;
    }

    return `<span style="${styles.join(';')}">${escaped}</span>`;
  }

  /**
   * Strip ANSI codes from text
   * @param {string} text
   * @returns {string}
   */
  static strip(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

/**
 * Convert ANSI text to HTML (convenience function)
 * @param {string} text
 * @returns {string}
 */
export function ansiToHtml(text) {
  return new AnsiRenderer().render(text);
}

/**
 * Strip ANSI codes (convenience function)
 * @param {string} text
 * @returns {string}
 */
export function stripAnsi(text) {
  return AnsiRenderer.strip(text);
}

/**
 * Create an ANSI renderer
 * @param {{ escapeHtml?: boolean }} [options]
 * @returns {AnsiRenderer}
 */
export function createAnsiRenderer(options) {
  return new AnsiRenderer(options);
}
