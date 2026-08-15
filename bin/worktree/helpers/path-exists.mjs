/**
 * WHAT: Checks a filesystem entry without following missing-path errors into callers.
 * WHY: Dependency and worktree admission needs one lstat-based existence boundary.
 */
import { lstatSync } from 'node:fs';

export function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
