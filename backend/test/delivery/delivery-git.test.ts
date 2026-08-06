import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RepositoryMutationLock } from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import {
  DeliveryGitError,
  observeDeliveryGitAuthority,
  preflightDeliveryGit,
  promoteDeliveryMain,
  verifyDeliveryCandidateGit,
  type DeliveryGitRunner,
} from '../../src/business/delivery/helper/delivery-git.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import { mutationReceiptEvidence } from '../../src/business/delivery/helper/delivery-coordinator.js';

const releaseSha = 'a'.repeat(40);
const priorMainSha = 'b'.repeat(40);
const mainSha = 'c'.repeat(40);
const protectedGitlink = 'd'.repeat(40);

function result(input: RunBoundedProcessInput, stdout = '', ok = true): BoundedProcessResult {
  return {
    ok,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 1,
    startedAt: '2026-07-28T00:00:00.000Z',
    finishedAt: '2026-07-28T00:00:00.001Z',
    durationMs: 1,
    exitCode: ok ? 0 : 1,
    signal: null,
    termination: null,
    stdout,
    stderr: ok ? '' : 'injected failure',
    stdoutTruncatedBytes: 0,
    stderrTruncatedBytes: 0,
    spawnError: null,
    context: input.context ?? {},
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-git-'));
  const identity = join(root, 'wise-key');
  writeFileSync(identity, 'fixture');
  const lock = {
    context: { root, gitDirectory: join(root, '.git'), commonDirectory: join(root, '.git'), indexFile: join(root, '.git', 'index') },
    owner: {
      version: 1,
      token: 'fixture',
      pid: process.pid,
      processIdentity: 'fixture',
      purpose: 'decision-os-delivery:test',
      head: priorMainSha,
      acquiredAt: '2026-07-28T00:00:00.000Z',
    },
    lockDirectory: join(root, '.git', 'decision-os', 'repository-mutation.lock'),
    release() {},
  } satisfies RepositoryMutationLock;
  return { root, identity, lock };
}

test('delivery Git preflight uses fetched refs and rejects no reviewed boundary', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const calls: string[][] = [];
  const runner: DeliveryGitRunner = async (input) => {
    const args = [...(input.args ?? [])];
    calls.push(args);
    const operation = String(input.context?.operation ?? '');
    if (operation === 'read_origin_dev') return result(input, releaseSha);
    if (operation === 'read_origin_main') return result(input, priorMainSha);
    if (operation === 'list_worktrees') return result(input, `worktree ${root}\nHEAD ${releaseSha}\nbranch refs/heads/dev\n`);
    if (operation === 'detect_active_operation') return result(input, '', false);
    return result(input);
  };
  const preflight = await preflightDeliveryGit({
    repositoryRoot: root,
    releaseSha,
    repositoryLock: lock,
    settings: { projectSyncGitSshIdentityFile: identity },
    protectedOwnerPaths: ['owned.md'],
    runner,
  });
  assert.equal(preflight.priorMainSha, priorMainSha);
  assert.equal(preflight.originDevSha, releaseSha);
  assert.ok(calls.some((args) => args.includes('fetch') && args.includes('main') && args.includes('dev')));
  assert.ok(calls.every((args) => !args.includes('--force')));
});

test('delivery main promotion verifies in an isolated worktree, re-fetches, then pushes exact SHA', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const integrationRoot = resolve(root, 'integration');
  mkdirSync(integrationRoot);
  const calls: Array<{ operation: string; args: string[] }> = [];
  const runner: DeliveryGitRunner = async (input) => {
    const operation = String(input.context?.operation ?? '');
    const args = [...(input.args ?? [])];
    calls.push({ operation, args });
    const output: Record<string, string> = {
      read_protected_gitlink: protectedGitlink,
      read_prior_main_sha: priorMainSha,
      read_staged_gitlink: protectedGitlink,
      read_merge_sha: mainSha,
      read_merge_parents: `${priorMainSha} ${releaseSha}`,
      read_final_gitlink: protectedGitlink,
      reread_origin_main: priorMainSha,
    };
    return result(input, output[operation] ?? '');
  };
  let verified = '';
  const promoted = await promoteDeliveryMain({
    preflight: { repositoryRoot: root, releaseSha, priorMainSha, originDevSha: releaseSha, releaseWorktrees: [] },
    repositoryLock: lock,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
    integrationRoot,
    async verifyCandidate({ mainSha: candidate }) {
      verified = candidate;
    },
  });
  assert.equal(promoted.mainSha, mainSha);
  assert.equal(promoted.protectedGitlink, protectedGitlink);
  assert.deepEqual(promoted.mergeParents, [priorMainSha, releaseSha]);
  assert.equal(verified, mainSha);
  const merge = calls.find((call) => call.operation === 'merge_release')!;
  assert.ok(merge.args.includes('--no-ff'));
  const commit = calls.find((call) => call.operation === 'commit_protected_merge')!;
  assert.ok(commit.args.some((argument) => argument.includes('WHAT:')));
  assert.ok(commit.args.some((argument) => argument.includes('WHY:')));
  const restore = calls.find((call) => call.operation === 'restore_protected_gitlink')!;
  assert.ok(restore.args.includes('.decision-os'));
  const push = calls.find((call) => call.operation === 'push_main')!;
  assert.ok(push.args.includes(`${mainSha}:refs/heads/main`));
  assert.ok(!push.args.includes('--force'));
});

test('delivery main promotion owns the Decision OS gitlink conflict and preserves main', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const integrationRoot = resolve(root, 'integration');
  mkdirSync(integrationRoot);
  const calls: string[] = [];
  const runner: DeliveryGitRunner = async (input) => {
    const operation = String(input.context?.operation ?? '');
    calls.push(operation);
    const output: Record<string, { stdout: string; ok?: boolean }> = {
      read_protected_gitlink: { stdout: protectedGitlink },
      simulate_protected_merge: { stdout: 'CONFLICT (submodule): Merge conflict in .decision-os', ok: false },
      read_prior_main_sha: { stdout: priorMainSha },
      merge_release: { stdout: 'CONFLICT (submodule): Merge conflict in .decision-os', ok: false },
      read_staged_gitlink: { stdout: protectedGitlink },
      read_merge_sha: { stdout: mainSha },
      read_merge_parents: { stdout: `${priorMainSha} ${releaseSha}` },
      read_final_gitlink: { stdout: protectedGitlink },
      reread_origin_main: { stdout: priorMainSha },
    };
    const selected = output[operation];
    return result(input, selected?.stdout ?? '', selected?.ok ?? true);
  };
  const promoted = await promoteDeliveryMain({
    preflight: { repositoryRoot: root, releaseSha, priorMainSha, originDevSha: releaseSha, releaseWorktrees: [] },
    repositoryLock: lock,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
    integrationRoot,
    async verifyCandidate() {},
  });
  assert.equal(promoted.protectedGitlink, protectedGitlink);
  assert.ok(calls.includes('restore_protected_gitlink'));
  assert.ok(!calls.includes('abort_protected_merge'));
});

test('delivery main promotion rejects a source conflict before starting the merge', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const integrationRoot = resolve(root, 'integration');
  mkdirSync(integrationRoot);
  const calls: string[] = [];
  const runner: DeliveryGitRunner = async (input) => {
    const operation = String(input.context?.operation ?? '');
    calls.push(operation);
    const output: Record<string, { stdout: string; ok?: boolean }> = {
      read_protected_gitlink: { stdout: protectedGitlink },
      simulate_protected_merge: { stdout: 'CONFLICT (content): Merge conflict in backend/source.ts', ok: false },
    };
    const selected = output[operation];
    return result(input, selected?.stdout ?? '', selected?.ok ?? true);
  };
  await assert.rejects(
    promoteDeliveryMain({
      preflight: { repositoryRoot: root, releaseSha, priorMainSha, originDevSha: releaseSha, releaseWorktrees: [] },
      repositoryLock: lock,
      settings: { projectSyncGitSshIdentityFile: identity },
      runner,
      integrationRoot,
      async verifyCandidate() {},
    }),
    (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_git_protected_merge_source_conflict',
  );
  assert.ok(!calls.includes('merge_release'));
});

test('delivery authority recovery requires exact parents and the preserved main gitlink', async (context) => {
  const { root, identity } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const runner = (finalGitlink: string): DeliveryGitRunner => async (input) => {
    const operation = String(input.context?.operation ?? '');
    const output: Record<string, string> = {
      observe_origin_dev: releaseSha,
      observe_origin_main: mainSha,
      observe_merge_parents: `${priorMainSha} ${releaseSha}`,
      observe_prior_gitlink: protectedGitlink,
      observe_final_gitlink: finalGitlink,
    };
    return result(input, output[operation] ?? '');
  };
  const exact = await observeDeliveryGitAuthority({
    repositoryRoot: root,
    admittedSha: releaseSha,
    priorMainSha,
    expectedMainSha: mainSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner: runner(protectedGitlink),
  });
  assert.equal(exact.exactMerge, true);
  assert.equal(exact.protectedGitlink, protectedGitlink);
  const changed = await observeDeliveryGitAuthority({
    repositoryRoot: root,
    admittedSha: releaseSha,
    priorMainSha,
    expectedMainSha: mainSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner: runner('e'.repeat(40)),
  });
  assert.equal(changed.exactMerge, false);
});

test('delivery mutation evidence retains protected merge identity in the durable phase receipt', () => {
  const evidence = mutationReceiptEvidence({
    receiptId: 'external-protected-merge',
    mutation: 'promote-main',
    targetSha: releaseSha,
    predecessor: priorMainSha,
    resultIdentity: mainSha,
    observedAt: '2026-08-06T00:00:00.000Z',
    evidence: [
      { key: 'protectedGitlink', value: protectedGitlink },
      { key: 'mergeFirstParent', value: priorMainSha },
      { key: 'mergeSecondParent', value: releaseSha },
    ],
  });
  assert.deepEqual(evidence.slice(-3), [
    { key: 'protectedGitlink', value: protectedGitlink },
    { key: 'mergeFirstParent', value: priorMainSha },
    { key: 'mergeSecondParent', value: releaseSha },
  ]);
});

test('delivery Git rejects a changed origin/dev before promotion mutation', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const runner: DeliveryGitRunner = async (input) => {
    const operation = String(input.context?.operation ?? '');
    if (operation === 'read_origin_dev') return result(input, 'd'.repeat(40));
    if (operation === 'read_origin_main') return result(input, priorMainSha);
    return result(input);
  };
  await assert.rejects(
    preflightDeliveryGit({
      repositoryRoot: root,
      releaseSha,
      repositoryLock: lock,
      settings: { projectSyncGitSshIdentityFile: identity },
      runner,
    }),
    (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_release_ref_changed',
  );
});

test('candidate Git verification rejects unpushed and dirty dev candidates without a delivery lease', async (context) => {
  const { root, identity } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const runner = (originDev: string, dirty = false): DeliveryGitRunner => async (input) => {
    const operation = String(input.context?.operation ?? '');
    if (operation === 'candidate_read_origin_dev') return result(input, originDev);
    if (operation === 'candidate_read_origin_main') return result(input, priorMainSha);
    if (operation === 'candidate_list_worktrees') return result(input, `worktree ${root}\nHEAD ${releaseSha}\nbranch refs/heads/dev\n`);
    if (operation === 'candidate_read_worktree_status') return result(input, dirty ? ' M backend/src/example.ts' : '');
    return result(input);
  };
  await assert.rejects(verifyDeliveryCandidateGit({
    repositoryRoot: root,
    releaseSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner: runner('d'.repeat(40)),
  }), (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_release_ref_changed');
  await assert.rejects(verifyDeliveryCandidateGit({
    repositoryRoot: root,
    releaseSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner: runner(releaseSha, true),
  }), (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_release_worktree_dirty');
  const verified = await verifyDeliveryCandidateGit({
    repositoryRoot: root,
    releaseSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner: runner(releaseSha),
  });
  assert.equal(verified.candidateWorktree, root);
  assert.equal(verified.originDevSha, releaseSha);
});
