import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RepositoryMutationLock } from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import {
  DeliveryGitError,
  observeDeliveryGitAuthority,
  preflightDeliveryGit,
  resolveDeliveryReleaseTag,
  verifyDeliveryCandidateGit,
  type DeliveryGitRunner,
} from '../../src/business/delivery/helper/delivery-git.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import { mutationReceiptEvidence } from '../../src/business/delivery/helper/delivery-coordinator.js';

const releaseSha = 'a'.repeat(40);
const priorMainSha = 'b'.repeat(40);
const mainSha = 'c'.repeat(40);
const protectedGitlink = 'd'.repeat(40);

test('canonical release tag pair resolves the exact published merge graph', async (context) => {
  const { root, identity } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const runner: DeliveryGitRunner = async (input) => {
    const output: Record<string, string> = {
      release_tag_main: mainSha,
      release_tag_dev: releaseSha,
      release_tag_origin_main: mainSha,
      release_tag_origin_dev: releaseSha,
      release_tag_merge_parents: `${priorMainSha} ${releaseSha}`,
    };
    return result(input, output[String(input.context?.operation ?? '')] ?? '');
  };
  const resolved = await resolveDeliveryReleaseTag({
    repositoryRoot: root,
    releaseTag: 'rel-0.3.1',
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
  });
  assert.deepEqual(resolved, { releaseTag: 'rel-0.3.1', releaseSha, mainSha, priorMainSha });
});

test('release tag pair rejects a tag that does not identify the published heads', async (context) => {
  const { root, identity } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const runner: DeliveryGitRunner = async (input) => {
    const output: Record<string, string> = {
      release_tag_main: 'e'.repeat(40),
      release_tag_dev: releaseSha,
      release_tag_origin_main: mainSha,
      release_tag_origin_dev: releaseSha,
    };
    return result(input, output[String(input.context?.operation ?? '')] ?? '');
  };
  await assert.rejects(resolveDeliveryReleaseTag({
    repositoryRoot: root,
    releaseTag: 'rel-0.3.1',
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
  }), (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_release_tag_ref_changed');
});

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

test('delivery Git preflight admits an exact published protected main merge without mutation', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const calls: string[][] = [];
  const runner: DeliveryGitRunner = async (input) => {
    const args = [...(input.args ?? [])];
    calls.push(args);
    const operation = String(input.context?.operation ?? '');
    if (operation === 'read_origin_dev') return result(input, releaseSha);
    if (operation === 'read_origin_main') return result(input, mainSha);
    // WHAT: Model the exact main merge produced by the standalone merge command.
    // WHY: Delivery preflight must consume this evidence without constructing another merge.
    if (operation === 'read_main_merge_parents') return result(input, `${priorMainSha} ${releaseSha}`);
    // WHAT: Model one unchanged protected gitlink across the merge.
    // WHY: The deploy-only admission must reject any main-owned child-state replacement.
    if (operation === 'read_main_gitlink' || operation === 'read_prior_main_gitlink') return result(input, protectedGitlink);
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
  assert.equal(preflight.mainSha, mainSha);
  assert.equal(preflight.protectedGitlink, protectedGitlink);
  assert.ok(calls.some((args) => args.includes('fetch') && args.includes('main') && args.includes('dev')));
  assert.ok(calls.every((args) => !args.includes('merge') && !args.includes('commit') && !args.includes('push')));
});

test('delivery Git preflight rejects a main commit not produced from the requested dev release', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const output: Record<string, string> = {
    read_origin_dev: releaseSha,
    read_origin_main: mainSha,
    read_main_merge_parents: `${priorMainSha} ${'e'.repeat(40)}`,
  };
  const runner: DeliveryGitRunner = async (input) => result(input, output[String(input.context?.operation ?? '')] ?? '');
  await assert.rejects(preflightDeliveryGit({
    repositoryRoot: root,
    releaseSha,
    repositoryLock: lock,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
  }), (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_main_merge_invalid');
});

test('delivery Git preflight rejects a published merge that changes the protected gitlink', async (context) => {
  const { root, identity, lock } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const output: Record<string, string> = {
    read_origin_dev: releaseSha,
    read_origin_main: mainSha,
    read_main_merge_parents: `${priorMainSha} ${releaseSha}`,
    read_main_gitlink: 'e'.repeat(40),
    read_prior_main_gitlink: protectedGitlink,
  };
  const runner: DeliveryGitRunner = async (input) => result(input, output[String(input.context?.operation ?? '')] ?? '');
  await assert.rejects(preflightDeliveryGit({
    repositoryRoot: root,
    releaseSha,
    repositoryLock: lock,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
  }), (error: unknown) => error instanceof DeliveryGitError && error.code === 'delivery_main_gitlink_changed');
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

test('delivery admission evidence retains protected merge identity in the durable phase receipt', () => {
  const evidence = mutationReceiptEvidence({
    receiptId: 'external-protected-merge',
    mutation: 'admit-main-release',
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

test('tag-resolved candidate does not require sibling merge parents to be ancestors', async (context) => {
  const { root, identity } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const operations: string[] = [];
  const runner: DeliveryGitRunner = async (input) => {
    const operation = String(input.context?.operation ?? '');
    operations.push(operation);
    if (operation === 'candidate_read_origin_dev') return result(input, releaseSha);
    if (operation === 'candidate_read_origin_main') return result(input, mainSha);
    if (operation === 'candidate_list_worktrees') return result(input, `worktree ${root}\nHEAD ${releaseSha}\nbranch refs/heads/dev\n`);
    return result(input);
  };
  const verified = await verifyDeliveryCandidateGit({
    repositoryRoot: root,
    releaseSha,
    priorMainSha,
    settings: { projectSyncGitSshIdentityFile: identity },
    runner,
  });
  assert.equal(verified.priorMainSha, priorMainSha);
  assert.equal(operations.includes('candidate_verify_main_ancestry'), false);
});
