/**
 * Utility Tests
 *
 * Tests for client utilities (HTML renderer, CSS applicator, ANSI renderer).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Note: These tests use jsdom
import { JSDOM } from 'jsdom';

import {
  HtmlRenderer,
  createHtmlRenderer,
  scopeStyles,
} from '../src/utils/html-renderer.js';

import {
  CssApplicator,
  createCssApplicator,
} from '../src/utils/css-applicator.js';

import {
  AnsiRenderer,
  ansiToHtml,
  stripAnsi,
  createAnsiRenderer,
} from '../src/utils/ansi-renderer.js';

// Set up jsdom for browser-like environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.ShadowRoot = dom.window.ShadowRoot;

describe('HtmlRenderer', () => {
  /** @type {HtmlRenderer} */
  let renderer;
  /** @type {HTMLElement} */
  let container;

  beforeEach(() => {
    renderer = createHtmlRenderer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    renderer.clearScripts();
  });

  describe('render', () => {
    it('should render HTML in direct mode', () => {
      const result = renderer.render('<p>Hello</p>', container);
      expect(container.innerHTML).toContain('Hello');
      expect(result.container).toBe(container);
    });

    it('should clear container by default', () => {
      container.innerHTML = '<span>old</span>';
      renderer.render('<p>new</p>', container);
      expect(container.innerHTML).not.toContain('old');
      expect(container.innerHTML).toContain('new');
    });

    it('should append when clear is false', () => {
      container.innerHTML = '<span>old</span>';
      renderer.render('<p>new</p>', container, { clear: false });
      expect(container.innerHTML).toContain('old');
      expect(container.innerHTML).toContain('new');
    });
  });

  describe('renderDisplayData', () => {
    it('should render displayData with text/html', () => {
      const displayData = {
        data: { 'text/html': '<p>Test</p>' },
      };
      renderer.renderDisplayData(displayData, container);
      expect(container.innerHTML).toContain('Test');
    });

    it('should return empty result for non-html displayData', () => {
      const displayData = {
        data: { 'text/plain': 'Test' },
      };
      const result = renderer.renderDisplayData(displayData, container);
      expect(result.scriptsExecuted).toBe(0);
    });
  });
});

describe('scopeStyles', () => {
  it('should prefix selectors with scope', () => {
    const css = '.foo { color: red; }';
    const scoped = scopeStyles(css, '.scope');
    expect(scoped).toContain('.scope .foo');
  });

  it('should handle multiple selectors', () => {
    const css = '.foo, .bar { color: red; }';
    const scoped = scopeStyles(css, '.scope');
    expect(scoped).toContain('.scope .foo');
    expect(scoped).toContain('.scope .bar');
  });

  it('should not scope @-rules', () => {
    const css = '@media screen { .foo { color: red; } }';
    const scoped = scopeStyles(css, '.scope');
    expect(scoped).toContain('@media screen');
  });
});

describe('CssApplicator', () => {
  /** @type {CssApplicator} */
  let applicator;

  beforeEach(() => {
    applicator = createCssApplicator(document.head);
  });

  afterEach(() => {
    applicator.clear();
  });

  describe('apply', () => {
    it('should apply CSS to document', () => {
      const result = applicator.apply('.test { color: red; }');
      expect(result.element).toBeInstanceOf(dom.window.HTMLStyleElement);
      expect(result.id).toBeDefined();
    });

    it('should replace style with same id', () => {
      applicator.apply('.test { color: red; }', { id: 'my-style' });
      const result = applicator.apply('.test { color: blue; }', { id: 'my-style' });
      expect(result.replaced).toBe(true);
      expect(result.element.textContent).toContain('blue');
    });

    it('should append when append option is true', () => {
      applicator.apply('.a { color: red; }', { id: 'my-style' });
      applicator.apply('.b { color: blue; }', { id: 'my-style', append: true });
      const element = applicator.get('my-style');
      expect(element?.textContent).toContain('.a');
      expect(element?.textContent).toContain('.b');
    });

    it('should scope CSS when scope option is provided', () => {
      const result = applicator.apply('.test { color: red; }', { scope: '.my-scope' });
      expect(result.element.textContent).toContain('.my-scope .test');
    });
  });

  describe('remove', () => {
    it('should remove applied style', () => {
      applicator.apply('.test { color: red; }', { id: 'to-remove' });
      expect(applicator.get('to-remove')).toBeDefined();

      const removed = applicator.remove('to-remove');
      expect(removed).toBe(true);
      expect(applicator.get('to-remove')).toBeUndefined();
    });

    it('should return false for unknown id', () => {
      expect(applicator.remove('unknown')).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all style ids', () => {
      applicator.apply('.a {}', { id: 'style-a' });
      applicator.apply('.b {}', { id: 'style-b' });

      const ids = applicator.list();
      expect(ids).toContain('style-a');
      expect(ids).toContain('style-b');
    });
  });

  describe('clear', () => {
    it('should remove all styles', () => {
      applicator.apply('.a {}');
      applicator.apply('.b {}');

      applicator.clear();
      expect(applicator.list().length).toBe(0);
    });
  });
});

describe('AnsiRenderer', () => {
  describe('render', () => {
    it('should convert basic colors', () => {
      const html = ansiToHtml('\x1b[31mred\x1b[0m');
      expect(html).toContain('color');
      expect(html).toContain('red');
    });

    it('should handle bold text', () => {
      const html = ansiToHtml('\x1b[1mbold\x1b[0m');
      expect(html).toContain('font-weight:bold');
      expect(html).toContain('bold');
    });

    it('should handle italic text', () => {
      const html = ansiToHtml('\x1b[3mitalic\x1b[0m');
      expect(html).toContain('font-style:italic');
    });

    it('should handle underline text', () => {
      const html = ansiToHtml('\x1b[4munderline\x1b[0m');
      expect(html).toContain('text-decoration:underline');
    });

    it('should handle background colors', () => {
      const html = ansiToHtml('\x1b[41mred bg\x1b[0m');
      expect(html).toContain('background-color');
    });

    it('should handle reset code', () => {
      const html = ansiToHtml('\x1b[31mred\x1b[0m normal');
      // After reset, "normal" should not be in a span
      expect(html).toContain('normal');
    });

    it('should escape HTML', () => {
      const html = ansiToHtml('<script>alert("xss")</script>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should handle empty input', () => {
      expect(ansiToHtml('')).toBe('');
    });

    it('should handle plain text', () => {
      expect(ansiToHtml('plain text')).toBe('plain text');
    });
  });

  describe('stripAnsi', () => {
    it('should remove ANSI codes', () => {
      const stripped = stripAnsi('\x1b[31mred\x1b[0m text');
      expect(stripped).toBe('red text');
    });

    it('should handle multiple codes', () => {
      const stripped = stripAnsi('\x1b[1m\x1b[31mbold red\x1b[0m');
      expect(stripped).toBe('bold red');
    });
  });

  describe('createAnsiRenderer', () => {
    it('should create renderer with options', () => {
      const renderer = createAnsiRenderer({ escapeHtml: false });
      const html = renderer.render('<b>test</b>');
      expect(html).toContain('<b>');
    });
  });
});
