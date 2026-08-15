/**
 * WHAT: Loads normalized path and branch ownership from Git worktree records.
 * WHY: Registration admission must compare canonical records rather than infer ownership from directories.
 */
import { resolve } from 'node:path';
import { git } from './git.mjs';
import { primaryRoot } from '../config.mjs';

export function registeredWorktrees() {
  const records = git(primaryRoot, ['worktree', 'list', '--porcelain']).stdout.split('\n\n').filter(Boolean);
  return records.map((record) => {
    const lines = record.split('\n');
    return {
      path: resolve(lines.find((line) => line.startsWith('worktree '))?.slice(9) ?? ''),
      branch: lines.find((line) => line.startsWith('branch '))?.slice(7) ?? '',
    };
  });
}
