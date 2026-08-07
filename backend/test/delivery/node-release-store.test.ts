import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapDecisionOsNode } from '../../src/business/delivery/controller/bootstrap-decision-os-node.js';
import {
  createNodeReleaseStore,
  NodeReleaseError,
  type NodeReleaseProcessRunner,
} from '../../src/business/delivery/helper/node-release-store.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';

const firstSha = 'a'.repeat(40);
const secondSha = 'b'.repeat(40);

function ok(input: RunBoundedProcessInput, stdout = ''): BoundedProcessResult {
  return {
    ok: true,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 1,
    startedAt: '2026-07-28T00:00:00.000Z',
    finishedAt: '2026-07-28T00:00:00.001Z',
    durationMs: 1,
    exitCode: 0,
    signal: null,
    termination: null,
    stdout,
    stderr: '',
    stdoutTruncatedBytes: 0,
    stderrTruncatedBytes: 0,
    spawnError: null,
    context: input.context ?? {},
  };
}

function releaseFixture() {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-node-release-'));
  const repositoryRoot = join(root, 'repository');
  const releaseRoot = join(root, 'releases-root');
  const decisionOsRoot = join(root, 'catalog', '.decision-os');
  const identity = join(root, 'wise-key');
  mkdirSync(repositoryRoot, { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(identity, 'fixture');
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const runner: NodeReleaseProcessRunner = async (input) => {
    const args = [...(input.args ?? [])];
    calls.push({ command: input.command, args, cwd: input.cwd });
    const operation = String(input.context?.operation ?? '');
    if (operation === 'read_origin_main') return ok(input, secondSha);
    if (operation === 'create_release_worktree') {
      const releasePath = args.at(-2)!;
      mkdirSync(join(releasePath, 'backend'), { recursive: true });
      mkdirSync(join(releasePath, 'frontend'), { recursive: true });
      mkdirSync(join(releasePath, 'bin'), { recursive: true });
      for (const workspace of ['', 'backend', 'frontend']) {
        writeFileSync(join(releasePath, workspace, 'package-lock.json'), '{}');
      }
      writeFileSync(join(releasePath, 'bin', 'decision-os-server.mjs'), '#!/usr/bin/env node\n');
    }
    return ok(input);
  };
  return { root, repositoryRoot, releaseRoot, decisionOsRoot, identity, calls, runner };
}

test('bootstrap prepares an immutable fetched release and adopts MultiTerm only through the injected fixture', async (context) => {
  const fixture = releaseFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const result = await bootstrapDecisionOsNode({
    nodeId: 'workstation',
    decisionOsRoot: fixture.decisionOsRoot,
    repositoryRoot: fixture.repositoryRoot,
    releaseRoot: fixture.releaseRoot,
    initialCommit: firstSha,
    settings: { projectSyncGitSshIdentityFile: fixture.identity },
    supervisorProfile: {
      profile: 'multiterm-workstation-v1',
      managerCommand: '/fixture/multiwezterm-process',
      catalogRoot: join(fixture.root, 'catalog'),
      port: 50150,
      url: 'http://127.0.0.1:50150/',
      name: 'decision-os-production',
      description: 'Decision OS production',
      automaticRestart: true,
    },
    runner: fixture.runner,
  });
  assert.equal(result.release.releaseSha, firstSha);
  assert.equal(result.settings.deliveryProtocol, 1);
  assert.equal(result.settings.deliverySupervisorAdopted, true);
  assert.match(result.settings.deliveryLocalDispatchToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(existsSync(join(fixture.releaseRoot, 'releases', firstSha, '.decision-os-release.json')));
  assert.equal(JSON.parse(readFileSync(join(fixture.decisionOsRoot, '.settings.json'), 'utf8')).deliveryCurrentPointer, join(fixture.releaseRoot, 'current'));
  const supervisor = fixture.calls.find((call) => call.command === '/fixture/multiwezterm-process')!;
  assert.deepEqual(supervisor.args.slice(0, 2), ['register', '--cwd']);
  assert.equal(supervisor.args[supervisor.args.indexOf('--cmd') + 1], `env PORT=50150 ${join(fixture.releaseRoot, 'current', 'bin', 'decision-os-server.mjs')}`);
  assert.ok(supervisor.args.includes('50150'));
  assert.ok(supervisor.args.includes('--no-launch'));
  assert.ok(fixture.calls.some((call) => call.args.includes('fetch') && call.args.includes('main')));
  assert.equal(fixture.calls.filter((call) => call.command === 'npm').length, 3);
});

test('node release activation and rollback use active-pointer compare-and-swap', async (context) => {
  const fixture = releaseFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const store = createNodeReleaseStore({
    repositoryRoot: fixture.repositoryRoot,
    releaseRoot: fixture.releaseRoot,
    settings: { projectSyncGitSshIdentityFile: fixture.identity },
    runner: fixture.runner,
  });
  await store.prepare(firstSha);
  const firstPath = store.releasePath(firstSha);
  mkdirSync(fixture.releaseRoot, { recursive: true });
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join('releases', firstSha), store.currentPointer);
  await store.prepare(secondSha);
  assert.equal(store.activate(secondSha, firstSha).activeCommit, secondSha);
  assert.throws(() => store.activate(firstSha, firstSha), (error: unknown) => (
    error instanceof NodeReleaseError && error.code === 'node_release_pointer_conflict'
  ));
  assert.equal(store.rollback(firstSha, secondSha).activeCommit, firstSha);
  assert.ok(existsSync(firstPath));
});

test('crash before operation-lease cleanup requires finite-expiry reconciliation before resume', async (context) => {
  const fixture = releaseFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  let observedAt = new Date('2026-07-28T00:00:00.000Z');
  let firstOwnerAlive = true;
  let crashBeforeCleanup = false;
  const firstStore = createNodeReleaseStore({
    repositoryRoot: fixture.repositoryRoot,
    releaseRoot: fixture.releaseRoot,
    settings: { projectSyncGitSshIdentityFile: fixture.identity, deliveryNodeId: 'workstation' },
    runner: fixture.runner,
    now: () => observedAt,
    operationLeaseDurationMs: 60_000,
    processId: 111,
    processIdentity: 'fixture:111:first',
    processIsActive: (owner) => owner.pid === 111 && firstOwnerAlive,
    operationHooks: {
      beforeLeaseRelease() {
        if (crashBeforeCleanup) throw new Error('injected-crash-before-operation-lease-cleanup');
      },
    },
  });
  await firstStore.prepare(firstSha);
  const { symlinkSync } = await import('node:fs');
  symlinkSync(join('releases', firstSha), firstStore.currentPointer);
  await firstStore.prepare(secondSha);
  crashBeforeCleanup = true;
  assert.throws(
    () => firstStore.activate(secondSha, firstSha),
    /injected-crash-before-operation-lease-cleanup/,
  );
  assert.equal(firstStore.active().releaseSha, secondSha);
  assert.ok(existsSync(firstStore.operationLeaseFile));

  firstOwnerAlive = false;
  observedAt = new Date('2026-07-28T00:01:01.000Z');
  const resumedStore = createNodeReleaseStore({
    repositoryRoot: fixture.repositoryRoot,
    releaseRoot: fixture.releaseRoot,
    settings: { projectSyncGitSshIdentityFile: fixture.identity, deliveryNodeId: 'workstation' },
    runner: fixture.runner,
    now: () => observedAt,
    processId: 222,
    processIdentity: 'fixture:222:resumed',
    processIsActive: () => false,
  });
  assert.throws(
    () => resumedStore.activate(firstSha, secondSha),
    (error: unknown) => error instanceof NodeReleaseError && error.code === 'node_release_operation_recovery_required',
  );
  assert.deepEqual(resumedStore.reconcileOperationLease({
    operation: 'activate',
    targetCommit: secondSha,
    expectedCommit: firstSha,
  }), { recovered: true, outcome: 'applied' });
  assert.equal(existsSync(resumedStore.operationLeaseFile), false);
  assert.equal(resumedStore.rollback(firstSha, secondSha).activeCommit, firstSha);
});

test('invalid release-operation lease bytes remain unchanged and pause the node release scope', (context) => {
  const fixture = releaseFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  mkdirSync(fixture.releaseRoot, { recursive: true });
  const operationLeaseFile = join(fixture.releaseRoot, 'release-operation.lock');
  const corrupt = Buffer.from([0xff, 0x7b, 0x00]);
  writeFileSync(operationLeaseFile, corrupt);
  const store = createNodeReleaseStore({
    repositoryRoot: fixture.repositoryRoot,
    releaseRoot: fixture.releaseRoot,
    settings: { projectSyncGitSshIdentityFile: fixture.identity, deliveryNodeId: 'workstation' },
    runner: fixture.runner,
    decisionOsRoot: fixture.decisionOsRoot,
  });
  const status = store.operationLeaseStatus();
  assert.equal(status.state, 'paused');
  assert.deepEqual(readFileSync(operationLeaseFile), corrupt);
  assert.throws(
    () => store.initialize(firstSha),
    (error: unknown) => error instanceof NodeReleaseError && error.code === 'node_release_operation_lease_invalid',
  );
  assert.deepEqual(readFileSync(operationLeaseFile), corrupt);
});

test('phone bootstrap fails explicitly without touching Git or a supervisor', async (context) => {
  const fixture = releaseFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    bootstrapDecisionOsNode({
      nodeId: 'phone',
      decisionOsRoot: fixture.decisionOsRoot,
      repositoryRoot: fixture.repositoryRoot,
      releaseRoot: fixture.releaseRoot,
      initialCommit: firstSha,
      settings: { projectSyncGitSshIdentityFile: fixture.identity },
      supervisorProfile: { profile: 'termux-unknown' },
      runner: fixture.runner,
    }),
    (error: unknown) => error instanceof NodeReleaseError && error.code === 'unsupported_supervisor_profile',
  );
  assert.equal(fixture.calls.length, 0);
});
