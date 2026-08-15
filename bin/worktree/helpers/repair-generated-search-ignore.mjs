/**
 * WHAT: Repairs only the reproduced generated Search ignore mutation.
 * WHY: Canonical dev setup must preserve every unexplained tracked byte.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedSearchIgnoreAfter, generatedSearchIgnoreBefore } from '../config.mjs';
import { git } from './git.mjs';
import { gitText } from './git-text.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function repairKnownGeneratedSearchIgnore(root) {
  const path = resolve(root, 'Search', '.decision-os', '.gitignore');
  // WHAT: Leave dev unchanged when the known generated fixture path is absent.
  // WHY: Repositories without the historical Search fixture need no migration.
  if (!existsSync(path)) return [];
  const status = gitText(root, ['status', '--porcelain=v1', '--', 'Search/.decision-os/.gitignore']);
  // WHAT: Leave the tracked fixture unchanged when Git reports no mutation.
  // WHY: Canonical setup is idempotent after the one-time generated-state repair.
  if (!status) return [];
  const head = git(root, ['show', 'HEAD:Search/.decision-os/.gitignore'], { raw: true }).stdout;
  const current = readFileSync(path, 'utf8');
  const expected = head.replace(generatedSearchIgnoreBefore, generatedSearchIgnoreAfter);
  // WHAT: Refuse every tracked change except the exact server-generated replacement reproduced by the isolated canary.
  // WHY: Dev setup must never erase operator-authored or unexplained tracked bytes.
  if (current !== expected || head === expected) {
    throw new WorktreeCliError('worktree_dev_tracked_dirty', 'Search/.decision-os/.gitignore contains noncanonical tracked changes.');
  }
  writeFileSync(path, head);
  return ['Search/.decision-os/.gitignore'];
}
