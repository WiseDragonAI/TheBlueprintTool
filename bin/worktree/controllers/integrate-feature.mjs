/**
 * WHAT: Controls feature publication, canonical dev merge, admission, push, and cleanup.
 * WHY: Delivery must settle against one immutable reviewed feature identity and one admitted dev SHA.
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { devRoot, primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertFeatureReady } from '../helpers/assert-feature-ready.mjs';
import { assertPublishedParentDev } from '../helpers/assert-published-parent-dev.mjs';
import { git } from '../helpers/git.mjs';
import { parseJsonOutput } from '../helpers/parse-json-output.mjs';
import { run } from '../helpers/run.mjs';
import { initDev } from './init-dev.mjs';
import { publishFeatureChild } from './publish-feature-child.mjs';

export function integrateFeature(name) {
  const feature = assertFeatureReady(name);
  assertPublishedParentDev();
  initDev({ deferLegacyRelay: true });
  const parentAdmission = assertPublishedParentDev();
  const childPublication = publishFeatureChild(feature, parentAdmission);
  const mergeMessage = `Merge ${feature.slug}`;
  git(devRoot, [
    'merge', '--no-ff', feature.featureSha,
    '-m', mergeMessage,
    '-m', `WHAT: Merge the exact reviewed ${feature.branch} feature into canonical dev.`,
    '-m', 'WHY: Deliver the verified feature through the repository-owned worktree lifecycle.',
  ], { timeout: 180_000 });
  initDev();
  const check = run(process.execPath, [resolve(devRoot, 'bin', 'decision-os-dev-integration-check.mjs'), '--feature', feature.featureSha, '--json'], {
    cwd: devRoot,
    timeout: 180_000,
    code: 'worktree_integration_check_failed',
  });
  const admission = parseJsonOutput(check.stdout, 'worktree_integration_receipt_invalid');
  // WHAT: Require the fixed integration checker to admit the exact merged dev SHA.
  // WHY: Push and cleanup authority belongs only to a successful immutable receipt.
  if (admission.ok !== true || !/^[a-f0-9]{40,64}$/.test(String(admission.devSha ?? ''))) {
    throw new WorktreeCliError('worktree_integration_rejected', JSON.stringify(admission));
  }
  run('git', ['push', 'origin', `${admission.devSha}:refs/heads/dev`], {
    cwd: devRoot,
    timeout: 180_000,
    env: { ...process.env, GIT_SSH_COMMAND: `ssh -i ${resolve(homedir(), '.ssh', 'id_jb_wise')} -o IdentitiesOnly=yes` },
    code: 'worktree_dev_push_failed',
  });
  git(primaryRoot, ['worktree', 'remove', '--force', feature.featureRoot], { timeout: 180_000 });
  git(primaryRoot, ['branch', '-D', feature.branch]);
  return {
    ok: true,
    command: 'integrate',
    name: feature.slug,
    featureSha: feature.featureSha,
    devSha: admission.devSha,
    decisionOsGitlink: admission.decisionOsGitlink,
    parentAdmission,
    childPublication,
    pushedRef: 'refs/heads/dev',
    cleanedWorktree: feature.featureRoot,
    deletedBranch: feature.branch,
    admission,
  };
}
