/**
 * HTML Rendering Types
 *
 * Types for HTML cell rendering with multiple isolation modes.
 */

/**
 * HTML rendering mode
 *
 * - 'direct': Inject HTML directly into page DOM (styles/scripts affect page)
 * - 'shadow': Use Shadow DOM for full CSS/JS isolation
 * - 'scoped': Use CSS class prefixing for style isolation without Shadow DOM
 */
export type RenderMode = 'direct' | 'shadow' | 'scoped';

/**
 * Options for HTML rendering
 */
export interface RenderOptions {
  /**
   * Rendering mode
   * @default 'direct'
   */
  mode?: RenderMode;

  /**
   * Unique ID for this render (used for script deduplication and CSS scoping)
   */
  execId?: string;

  /**
   * Custom scope class name (for 'scoped' mode)
   * If not provided, will be generated from execId
   */
  scopeClass?: string;

  /**
   * Whether to execute scripts
   * @default true
   */
  executeScripts?: boolean;

  /**
   * Callback when a script error occurs
   */
  onScriptError?: (error: Error, script: string) => void;
}

/**
 * Result of extracting scripts and styles from HTML
 */
export interface ExtractResult {
  /** HTML with scripts and styles removed */
  html: string;
  /** Extracted script contents */
  scripts: string[];
  /** Extracted style contents */
  styles: string[];
}

/**
 * Result of HTML rendering
 */
export interface RenderResult {
  /** The container element that was rendered into */
  container: HTMLElement;
  /** Shadow root if shadow mode was used */
  shadowRoot?: ShadowRoot;
  /** Number of scripts executed */
  scriptsExecuted: number;
  /** Any script errors that occurred */
  scriptErrors: Error[];
}
