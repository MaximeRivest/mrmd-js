/**
 * Constants
 *
 * Runtime constants for mrmd-js.
 * @module constants
 */

/** Runtime name */
export const RUNTIME_NAME = 'mrmd-js';

/** Runtime version */
export const RUNTIME_VERSION = '2.0.0';

/** Default session ID */
export const DEFAULT_SESSION = 'default';

/** Default max sessions */
export const DEFAULT_MAX_SESSIONS = 10;

/** Supported languages */
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'js',
  'html',
  'htm',
  'css',
  'style',
];

/** Default features */
export const DEFAULT_FEATURES = {
  execute: true,
  executeStream: true,
  interrupt: false, // Limited in browser
  complete: true,
  inspect: true,
  hover: true,
  variables: true,
  variableExpand: true,
  reset: true,
  isComplete: true,
  format: true,
  assets: true,
};
