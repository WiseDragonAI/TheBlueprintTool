/**
 * WHAT: Reads exact tracked and untracked Git status for one ownership boundary.
 * WHY: Controllers need a consistent cleanliness proof with explicit submodule handling.
 */
import { gitText } from './git-text.mjs';

export function exactStatus(root, ignoredSubmodules = false) {
  const args = ['status', '--porcelain=v1', '--untracked-files=all'];
  // WHAT: Ignore mutable child checkout bytes only for the parent cleanliness boundary that owns a gitlink.
  // WHY: Parent integration cleanliness and child authored cleanliness are verified independently.
  if (ignoredSubmodules) args.push('--ignore-submodules=all');
  return gitText(root, args);
}
