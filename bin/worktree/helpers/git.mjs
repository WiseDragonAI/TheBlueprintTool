/**
 * WHAT: Runs one Git command with the repository-owned environment boundary.
 * WHY: All lifecycle Git calls need the same cwd, system-config isolation, and command failure semantics.
 */
import { run } from './run.mjs';
import { primaryRoot } from '../config.mjs';

export function git(root, args, options = {}) {
  return run('git', args, { ...options, cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...(options.env ?? {}) } });
}
