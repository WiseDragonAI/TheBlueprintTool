/**
 * WHAT: Installs and verifies the canonical dev Decision OS child checkout.
 * WHY: The persistent dev server reads checkout bytes that must equal the parent gitlink.
 */
import { resolve } from 'node:path';
import { devRoot } from '../config.mjs';
import { git } from './git.mjs';
import { gitText } from './git-text.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function installDevChild() {
  git(devRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--', '.decision-os'], { timeout: 180_000 });
  git(devRoot, ['config', '--worktree', 'submodule..decision-os.ignore', 'all']);
  const gitlink = gitText(devRoot, ['rev-parse', 'HEAD:.decision-os']);
  const checkout = gitText(resolve(devRoot, '.decision-os'), ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Require the persistent child checkout to install the exact parent gitlink.
  // WHY: The dev server reads checkout bytes rather than the parent tree object.
  if (gitlink !== checkout) throw new WorktreeCliError('worktree_dev_child_mismatch', `Dev child ${checkout} does not match ${gitlink}.`);
  return gitlink;
}
