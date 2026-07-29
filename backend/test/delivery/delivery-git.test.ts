import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RepositoryMutationLock } from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import {
  DeliveryGitError,
  preflightDeliveryGit,
  promoteDeliveryMain,
  verifyDeliveryCandidateGit,
  type DeliveryGitRunner,
} from '../../src/business/delivery/helper/delivery-git.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';

const releaseSha = 'a'.repeat(40);
const priorMainSha = 'b'.repeat(40);
const mainSha = 'c'.repeat(40);

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
    if (operation === 'read_merge_sha') return result(input, mainSha);
    if (operation === 'reread_origin_main') return result(input, priorMainSha);
    return result(input);
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
  assert.equal(verified, mainSha);
  const merge = calls.find((call) => call.operation === 'merge_release')!;
  assert.ok(merge.args.includes('--no-ff'));
  assert.ok(merge.args.some((argument) => argument.startsWith('WHAT:')));
  assert.ok(merge.args.some((argument) => argument.startsWith('WHY:')));
  const push = calls.find((call) => call.operation === 'push_main')!;
  assert.ok(push.args.includes(`${mainSha}:refs/heads/main`));
  assert.ok(!push.args.includes('--force'));
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
