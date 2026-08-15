/**
 * WHAT: Returns normalized stdout from one admitted Git command.
 * WHY: Read-only Git derivations should not repeat command settlement plumbing.
 */
import { git } from './git.mjs';

export function gitText(root, args) {
  return git(root, args).stdout;
}
