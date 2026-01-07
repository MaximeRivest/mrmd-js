/**
 * Runtime Variable Explorer
 *
 * Lists and inspects variables in the JavaScript runtime scope.
 * Like RStudio's Environment pane or Jupyter's Variable Inspector.
 */

import type { VariableInfo, SandboxWindow } from '../types';

/**
 * Maximum length for value preview in variable list
 */
const MAX_PREVIEW_LENGTH = 100;

/**
 * Get the size/length info for a value
 */
function getSizeInfo(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (value instanceof Map) {
    return `${value.size} entries`;
  }

  if (value instanceof Set) {
    return `${value.size} items`;
  }

  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return `${keys.length} keys`;
  }

  if (typeof value === 'string') {
    return `${value.length} chars`;
  }

  return undefined;
}

/**
 * Get a type string for a value
 */
function getTypeString(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'function') {
    const fn = value as Function;
    const source = fn.toString();

    if (/^class\s/.test(source)) {
      return 'class';
    }
    if (/^async\s/.test(source)) {
      return 'async function';
    }
    return 'function';
  }

  if (type === 'object') {
    if (Array.isArray(value)) {
      return 'array';
    }
    const constructor = (value as object).constructor?.name;
    if (constructor && constructor !== 'Object') {
      return constructor.toLowerCase();
    }
    return 'object';
  }

  return type;
}

/**
 * Get a preview string for a value
 */
function getValuePreview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string') {
    const str = value as string;
    if (str.length > MAX_PREVIEW_LENGTH - 2) {
      return `"${str.slice(0, MAX_PREVIEW_LENGTH - 5)}..."`;
    }
    return `"${str}"`;
  }

  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return String(value);
  }

  if (type === 'symbol') {
    return (value as symbol).toString();
  }

  if (type === 'function') {
    const fn = value as Function;
    const source = fn.toString();

    if (/^class\s/.test(source)) {
      return `class ${fn.name || 'anonymous'}`;
    }

    const paramMatch = source.match(/^(?:async\s+)?(?:function\s*)?(?:\w*\s*)?\(([^)]*)\)/);
    const params = paramMatch ? paramMatch[1].trim() : '';
    const asyncPrefix = /^async\s/.test(source) ? 'async ' : '';

    if (fn.name) {
      return `${asyncPrefix}ƒ ${fn.name}(${params})`;
    }
    return `${asyncPrefix}ƒ (${params})`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) {
      const items = value.map((v) => {
        if (typeof v === 'string') return `"${v.slice(0, 20)}"`;
        if (typeof v === 'object') return '{...}';
        return String(v).slice(0, 20);
      });
      return `[${items.join(', ')}]`;
    }
    return `[${value.length} items]`;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const constructor = obj.constructor?.name;

    // Special cases
    if (constructor === 'Date') {
      return (value as Date).toISOString();
    }
    if (constructor === 'RegExp') {
      return (value as RegExp).toString();
    }
    if (constructor === 'Map') {
      return `Map(${(value as Map<unknown, unknown>).size})`;
    }
    if (constructor === 'Set') {
      return `Set(${(value as Set<unknown>).size})`;
    }
    if (constructor === 'Error') {
      const err = value as Error;
      return `${err.name}: ${err.message}`;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) {
      const preview = keys.map((k) => `${k}: ...`).join(', ');
      return `{${preview}}`;
    }

    const prefix = constructor && constructor !== 'Object' ? constructor + ' ' : '';
    return `${prefix}{${keys.length} keys}`;
  }

  return String(value).slice(0, MAX_PREVIEW_LENGTH);
}

/**
 * Check if a value is expandable (has children to explore)
 */
function isExpandable(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  const type = typeof value;

  if (type === 'object') {
    return true;
  }

  if (type === 'function') {
    // Functions have properties but usually not interesting to expand
    return false;
  }

  return false;
}

/**
 * Get information about all variables in scope
 */
export function getVariables(
  userVars: Record<string, unknown>
): VariableInfo[] {
  const variables: VariableInfo[] = [];

  for (const [name, value] of Object.entries(userVars)) {
    variables.push({
      name,
      type: getTypeString(value),
      value: getValuePreview(value),
      size: getSizeInfo(value),
      expandable: isExpandable(value),
    });
  }

  // Sort alphabetically
  variables.sort((a, b) => a.name.localeCompare(b.name));

  return variables;
}

/**
 * Get detailed information about a specific variable
 */
export function getVariableDetail(
  name: string,
  ctx: SandboxWindow | null
): VariableInfo | null {
  if (!ctx) return null;

  try {
    const value = ctx.eval(name);

    return {
      name,
      type: getTypeString(value),
      value: getValuePreview(value),
      size: getSizeInfo(value),
      expandable: isExpandable(value),
    };
  } catch {
    return null;
  }
}

/**
 * Expand a variable to see its children (properties/elements)
 */
export function expandVariable(
  path: string,
  ctx: SandboxWindow | null
): VariableInfo[] | null {
  if (!ctx) return null;

  try {
    const value = ctx.eval(path);

    if (value === null || value === undefined) {
      return null;
    }

    const children: VariableInfo[] = [];

    if (Array.isArray(value)) {
      // For arrays, show indices
      const maxShow = Math.min(value.length, 100);
      for (let i = 0; i < maxShow; i++) {
        const item = value[i];
        children.push({
          name: `[${i}]`,
          type: getTypeString(item),
          value: getValuePreview(item),
          size: getSizeInfo(item),
          expandable: isExpandable(item),
        });
      }
      if (value.length > maxShow) {
        children.push({
          name: '...',
          type: 'more',
          value: `${value.length - maxShow} more items`,
          expandable: false,
        });
      }
    } else if (typeof value === 'object') {
      // For objects, show properties
      const keys = Object.keys(value);
      const maxShow = Math.min(keys.length, 100);

      for (let i = 0; i < maxShow; i++) {
        const key = keys[i];
        const propValue = (value as Record<string, unknown>)[key];
        children.push({
          name: key,
          type: getTypeString(propValue),
          value: getValuePreview(propValue),
          size: getSizeInfo(propValue),
          expandable: isExpandable(propValue),
        });
      }

      if (keys.length > maxShow) {
        children.push({
          name: '...',
          type: 'more',
          value: `${keys.length - maxShow} more properties`,
          expandable: false,
        });
      }
    }

    return children;
  } catch {
    return null;
  }
}
