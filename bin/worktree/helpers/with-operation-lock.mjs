/**
 * WHAT: Serializes one repository-global worktree mutation behind an auditable lock.
 * WHY: Creation, merge, child installation, push, and cleanup share refs and paths that cannot mutate concurrently.
 */
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { primaryRoot } from '../config.mjs';
import { gitText } from './git-text.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function withOperationLock(operation) {
  const commonDirectory = resolve(primaryRoot, gitText(primaryRoot, ['rev-parse', '--git-common-dir']));
  const lockFile = resolve(commonDirectory, 'decision-os-worktree.lock');
  let descriptor;
  try {
    descriptor = openSync(lockFile, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, cwd: process.cwd(), startedAt: new Date().toISOString() })}\n`);
  } catch (error) {
    // WHAT: Report one active lifecycle owner instead of running concurrent Git mutations.
    // WHY: Worktree creation, merge, child installation, push, and cleanup share repository-global refs and paths.
    if (error?.code === 'EEXIST') {
      let owner = {};
      try { owner = JSON.parse(readFileSync(lockFile, 'utf8')); } catch { owner = {}; }
      let active = false;
      try {
        process.kill(Number(owner.pid), 0);
        active = Number.isInteger(Number(owner.pid)) && Number(owner.pid) > 0;
      } catch {
        active = false;
      }
      // WHAT: Reject a lock owned by a live process.
      // WHY: An active lifecycle transaction must reach its own terminal cleanup boundary.
      if (active) throw new WorktreeCliError('worktree_operation_locked', `Worktree operation is owned by PID ${owner.pid}.`);
      unlinkSync(lockFile);
      return withOperationLock(operation);
    }
    throw error;
  }
  try {
    return operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockFile);
  }
}
