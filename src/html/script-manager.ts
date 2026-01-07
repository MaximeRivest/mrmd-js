/**
 * Script Execution Manager
 *
 * Prevents re-execution of scripts when HTML widgets are recreated
 * (e.g., on viewport scroll in virtualized editors). Each execution ID
 * tracks which scripts have already run via content hashing.
 *
 * This is essential for:
 * - Preventing side effects from running twice
 * - Avoiding duplicate event listeners
 * - Maintaining correct state in interactive widgets
 */

/** Map of execId -> Set of script content hashes that have been executed */
const executedScripts = new Map<string, Set<string>>();

/**
 * Simple hash function for script content
 * Uses djb2 algorithm - fast and good distribution for strings
 */
export function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Execute scripts for a cell, skipping any that have already run
 *
 * @param execId - Unique execution ID for this cell/render
 * @param scripts - Array of script contents to execute
 * @param context - The element or shadow root to use as `this` context
 * @param onError - Optional callback for script errors
 * @returns Number of scripts actually executed (not skipped)
 */
export function executeScripts(
  execId: string,
  scripts: string[],
  context: Element | ShadowRoot,
  onError?: (error: Error, script: string) => void
): number {
  if (!executedScripts.has(execId)) {
    executedScripts.set(execId, new Set());
  }
  const executed = executedScripts.get(execId)!;
  let count = 0;

  for (const script of scripts) {
    const trimmed = script.trim();
    if (!trimmed) continue;

    const hash = hashContent(trimmed);
    if (executed.has(hash)) {
      // Already executed, skip
      continue;
    }
    executed.add(hash);

    try {
      // Create function and execute with context as `this`
      // This allows scripts to access the container via `this`
      const fn = new Function(trimmed);
      fn.call(context);
      count++;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err, trimmed);
      } else {
        console.error(`[ScriptManager ${execId}] Script error:`, err);
      }
    }
  }

  return count;
}

/**
 * Clear tracked scripts for a specific execution ID
 * Call this before re-executing a cell to allow scripts to run again
 *
 * @param execId - Execution ID to clear
 */
export function clearScripts(execId: string): void {
  executedScripts.delete(execId);
}

/**
 * Clear all tracked scripts across all execution IDs
 * Useful when resetting the entire runtime
 */
export function clearAllScripts(): void {
  executedScripts.clear();
}

/**
 * Check if any scripts have been executed for an execution ID
 *
 * @param execId - Execution ID to check
 */
export function hasExecutedScripts(execId: string): boolean {
  const set = executedScripts.get(execId);
  return set !== undefined && set.size > 0;
}

/**
 * Get the number of unique scripts executed for an execution ID
 *
 * @param execId - Execution ID to check
 */
export function getExecutedCount(execId: string): number {
  return executedScripts.get(execId)?.size ?? 0;
}

/**
 * Check if a specific script has been executed
 *
 * @param execId - Execution ID
 * @param script - Script content to check
 */
export function hasExecutedScript(execId: string, script: string): boolean {
  const set = executedScripts.get(execId);
  if (!set) return false;
  return set.has(hashContent(script.trim()));
}
