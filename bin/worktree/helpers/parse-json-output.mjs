/**
 * WHAT: Parses the final JSON line from one admitted child command.
 * WHY: Integration receipts need a narrow parser that rejects ambiguous process output.
 */
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function parseJsonOutput(text, code) {
  try {
    return JSON.parse(text.trim().split('\n').at(-1) ?? '');
  } catch {
    throw new WorktreeCliError(code, `Expected JSON output, received: ${text.trim()}`, 3);
  }
}
