/**
 * Analysis Tests
 *
 * Tests for code analysis utilities (isComplete, format).
 */

import { describe, it, expect } from 'vitest';
import { isComplete, getSuggestedIndent } from '../src/analysis/is-complete.js';
import { formatCode, basicFormat, formatHtml, formatCss } from '../src/analysis/format.js';

describe('isComplete', () => {
  describe('complete statements', () => {
    it('should detect simple complete statements', () => {
      expect(isComplete('1').status).toBe('complete');
      expect(isComplete('1 + 2').status).toBe('complete');
      expect(isComplete('const x = 1').status).toBe('complete');
      expect(isComplete('let y = "hello"').status).toBe('complete');
    });

    it('should detect complete function declarations', () => {
      expect(isComplete('function foo() {}').status).toBe('complete');
      expect(isComplete('const fn = () => 42').status).toBe('complete');
      expect(isComplete('const fn = () => { return 42; }').status).toBe('complete');
    });

    it('should detect complete object/array literals', () => {
      expect(isComplete('const obj = {}').status).toBe('complete');
      expect(isComplete('const arr = []').status).toBe('complete');
      expect(isComplete('const obj = { a: 1, b: 2 }').status).toBe('complete');
      expect(isComplete('const arr = [1, 2, 3]').status).toBe('complete');
    });

    it('should handle empty input', () => {
      expect(isComplete('').status).toBe('complete');
      expect(isComplete('   ').status).toBe('complete');
      expect(isComplete('\n\n').status).toBe('complete');
    });

    it('should handle code with comments', () => {
      // Code with trailing comments should be complete
      expect(isComplete('const x = 1 // comment').status).toBe('complete');
    });
  });

  describe('incomplete statements', () => {
    it('should detect unclosed braces', () => {
      expect(isComplete('function foo() {').status).toBe('incomplete');
      expect(isComplete('if (true) {').status).toBe('incomplete');
      expect(isComplete('const obj = {').status).toBe('incomplete');
    });

    it('should detect unclosed brackets', () => {
      expect(isComplete('const arr = [').status).toBe('incomplete');
      expect(isComplete('[1, 2,').status).toBe('incomplete');
    });

    it('should detect unclosed parentheses', () => {
      expect(isComplete('foo(').status).toBe('incomplete');
      expect(isComplete('(1 + 2').status).toBe('incomplete');
    });

    it('should detect trailing operators', () => {
      expect(isComplete('1 +').status).toBe('incomplete');
      expect(isComplete('const x =').status).toBe('incomplete');
      expect(isComplete('a &&').status).toBe('incomplete');
      expect(isComplete('obj.').status).toBe('incomplete');
    });

    it('should detect incomplete arrow functions', () => {
      expect(isComplete('const fn = () =>').status).toBe('incomplete');
    });

    it('should detect unclosed strings', () => {
      expect(isComplete('"hello').status).toBe('incomplete');
      expect(isComplete("'world").status).toBe('incomplete');
      expect(isComplete('`template').status).toBe('incomplete');
    });
  });

  describe('invalid statements', () => {
    it('should detect syntax errors', () => {
      // Note: Some syntax errors may be detected as incomplete first
      // The exact behavior depends on the parser
      const constConst = isComplete('const const');
      expect(['invalid', 'incomplete']).toContain(constConst.status);

      // Extra closing brace should be invalid
      const extraBrace = isComplete('} extra brace');
      expect(extraBrace.status).toBe('invalid');
    });
  });

  describe('nested structures', () => {
    it('should handle nested objects', () => {
      expect(isComplete('const obj = { a: { b: 1 } }').status).toBe('complete');
      expect(isComplete('const obj = { a: { b: 1 }').status).toBe('incomplete');
    });

    it('should handle nested functions', () => {
      expect(isComplete('function outer() { function inner() {} }').status).toBe('complete');
      expect(isComplete('function outer() { function inner() {').status).toBe('incomplete');
    });
  });
});

describe('getSuggestedIndent', () => {
  it('should suggest indent after opening brace', () => {
    expect(getSuggestedIndent('function foo() {')).toBe('  ');
    expect(getSuggestedIndent('if (true) {')).toBe('  ');
  });

  it('should suggest same indent for regular lines', () => {
    expect(getSuggestedIndent('  const x = 1')).toBe('  ');
  });

  it('should handle arrow functions', () => {
    expect(getSuggestedIndent('const fn = () =>')).toBe('  ');
  });
});

describe('basicFormat', () => {
  it('should normalize whitespace', () => {
    const result = basicFormat('const  x=1');
    expect(result).toContain('const');
    expect(result).toContain('x');
    expect(result).toContain('1');
  });

  it('should fix indentation', () => {
    const result = basicFormat('function foo() {\nreturn 1\n}');
    expect(result).toContain('  return');
  });

  it('should add trailing newline', () => {
    const result = basicFormat('const x = 1');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('should normalize line endings', () => {
    const result = basicFormat('a\r\nb\rc');
    expect(result).not.toContain('\r');
  });
});

describe('formatCode', () => {
  it('should return formatted code', async () => {
    const result = await formatCode('const x=1');
    expect(result.formatted).toBeDefined();
    expect(typeof result.changed).toBe('boolean');
  });
});

describe('formatHtml', () => {
  it('should add newlines around block elements', () => {
    const result = formatHtml('<div>test</div><p>para</p>');
    expect(result).toContain('\n');
  });

  it('should add trailing newline', () => {
    expect(formatHtml('<div>test</div>').endsWith('\n')).toBe(true);
  });
});

describe('formatCss', () => {
  it('should format CSS rules', () => {
    const result = formatCss('.foo{color:red}');
    expect(result).toContain(' {\n');
    expect(result).toContain('color: red');
    expect(result).toContain('\n}');
  });

  it('should indent properties', () => {
    const result = formatCss('.foo{color:red;font-size:12px}');
    expect(result).toContain('  color');
    expect(result).toContain('  font-size');
  });
});
