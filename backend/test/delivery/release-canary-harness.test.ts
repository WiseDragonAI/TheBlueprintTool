/**
 * WHAT: Verifies immutable full-catalog snapshot, no-follow copying, source-write rejection, drift-safe cleanup, and fixed CLI inputs.
 * WHY: Permanent canary tooling must preserve live state and delete only manifest-owned resources.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanupReleaseCanaryRun,
  createReleaseCanarySnapshot,
  inventoryReleaseCanarySource,
  recordReleaseCanaryExternalWorker,
  recordReleaseCanaryExternalWorkerRestored,
  readReleaseCanaryManifest,
  ReleaseCanaryHarnessError,
} from '../../src/business/delivery/helper/release-canary-harness.js';
import { proveReleaseCanaryGitSandbox } from '../../src/business/delivery/helper/release-canary-git-sandbox.js';
import { deployReleaseCanaryDevWorker, restoreReleaseCanaryDevWorker } from '../../src/business/delivery/helper/release-canary-dev-worker.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../src/business/task-state/helper/task-current-state-types.js';
import {
  createDefaultReleaseCanaryCliRuntime,
  parseDecisionOsReleaseCanaryArguments,
  ReleaseCanaryCliError,
  runDecisionOsReleaseCanaryCli,
  type ReleaseCanaryCliRuntime,
} from '../../src/cli/decision-os-release-canary.js';
import type { ReleaseCanaryCompletedPhases } from '../../src/business/delivery/helper/release-canary-proof-orchestrator.js';

function fixture(): {
  root: string;
  repositoryRoot: string;
  catalogRoot: string;
  masterRoot: string;
  nestedDecisionOsRoot: string;
  releaseRoot: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-release-canary-test-'));
  const repositoryRoot = join(root, 'repository');
  const catalogRoot = join(root, 'catalog');
  const masterRoot = join(catalogRoot, '.decision-os');
  const releaseRoot = join(root, 'production-releases');
  const activeReleaseSha = 'a'.repeat(40);
  const nestedDecisionOsRoot = join(catalogRoot, 'projects', 'nested', '.decision-os');
  const ardariaDecisionOsRoot = join(root, 'ardaria-external', '.decision-os');
  mkdirSync(join(repositoryRoot, '.git'), { recursive: true });
  mkdirSync(join(masterRoot, 'task-state', 'root-project', 'current'), { recursive: true });
  mkdirSync(join(masterRoot, 'cache'), { recursive: true });
  mkdirSync(join(masterRoot, 'delivery'), { recursive: true });
  mkdirSync(join(masterRoot, '.git'), { recursive: true });
  mkdirSync(join(masterRoot, 'migrations'), { recursive: true });
  mkdirSync(join(nestedDecisionOsRoot, 'task-state', 'nested-project', 'current'), { recursive: true });
  mkdirSync(join(nestedDecisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(join(ardariaDecisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(join(nestedDecisionOsRoot, 'nested', '.decision-os', 'runtime'), { recursive: true });
  writeFileSync(join(masterRoot, 'projects.json'), `${JSON.stringify({
    version: 2,
    projects: {
      ardaria: {
        id: 'ardaria', relativePath: '../ardaria-external', name: 'Ardaria', description: '', color: '#222222',
        registeredAt: '2026-08-07T00:00:00.000Z', cardId: 'card-ardaria',
      },
      'root-project': {
        id: 'root-project', relativePath: '.', name: 'Root', description: '', color: '#000000',
        registeredAt: '2026-08-07T00:00:00.000Z', cardId: 'card-root',
      },
      'nested-project': {
        id: 'nested-project', relativePath: 'projects/nested', name: 'Nested', description: '', color: '#111111',
        registeredAt: '2026-08-07T00:00:00.000Z', cardId: 'card-nested',
      },
    },
  }, null, 2)}\n`);
  writeFileSync(join(masterRoot, 'runtime-incidents.json'), '{"version":1,"incidents":[{"id":"master-incident"}]}\n');
  mkdirSync(join(releaseRoot, 'releases', activeReleaseSha, 'bin'), { recursive: true });
  writeFileSync(join(releaseRoot, 'releases', activeReleaseSha, 'bin', 'decision-os-server.mjs'), 'release launcher\n');
  writeFileSync(join(releaseRoot, 'release-marker.json'), '{"release":true}\n');
  symlinkSync(`releases/${activeReleaseSha}`, join(releaseRoot, 'current'));
  writeFileSync(join(masterRoot, '.settings.json'), `${JSON.stringify({ secret: 'must-not-copy', deliveryReleaseRoot: releaseRoot })}\n`);
  writeFileSync(join(masterRoot, '.git', 'config'), 'archive-git-metadata\n');
  writeFileSync(join(masterRoot, 'delivery', 'authority.json'), '{"credential":"archive-delivery-secret"}\n');
  writeFileSync(join(masterRoot, 'cache', 'live-cache.json'), '{"omit":true}\n');
  writeFileSync(join(masterRoot, 'frontend-telemetry.jsonl.rotated-1'), '{"omit":true}\n');
  writeFileSync(join(masterRoot, 'migrations', 'retained.json'), '{"retain":true}\n');
  writeFileSync(join(masterRoot, 'task-state', 'root-project', 'current', 'root.json'), '{"root":true}\n');
  writeFileSync(join(masterRoot, 'task-state', 'root-project', 'format.json'), '{"projectId":"root-project"}\n');
  writeFileSync(join(nestedDecisionOsRoot, 'runtime-incidents.json'), '{"version":1,"incidents":[{"id":"nested-incident"}]}\n');
  writeFileSync(join(nestedDecisionOsRoot, 'task-state', 'nested-project', 'current', 'nested.json'), '{"nested":true}\n');
  writeFileSync(join(nestedDecisionOsRoot, 'cards', 'card.md'), '# Card\n');
  writeFileSync(join(ardariaDecisionOsRoot, 'cards', 'ardaria.md'), '# Ardaria\n');
  writeFileSync(join(nestedDecisionOsRoot, 'nested', '.decision-os', '.settings.json'), '{"secret":"nested-must-not-copy"}\n');
  writeFileSync(join(nestedDecisionOsRoot, 'nested', '.decision-os', 'runtime', 'process.json'), '{"pid":123}\n');
  symlinkSync('cards/card.md', join(nestedDecisionOsRoot, 'internal-link'));
  git(join(catalogRoot, 'projects', 'nested'), ['init', '--initial-branch=main']);
  git(join(catalogRoot, 'projects', 'nested'), ['remote', 'add', 'origin', 'ssh://secret-bearing-source.example/project.git']);
  writeFileSync(join(root, 'outside-do-not-follow'), 'outside-secret\n');
  return { root, repositoryRoot, catalogRoot, masterRoot, nestedDecisionOsRoot, releaseRoot };
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function canonicalRepository(root: string): string {
  const childSource = join(root, 'child-source');
  const childBare = join(root, 'child.git');
  const parent = join(root, 'canonical-parent');
  git(root, ['init', '--initial-branch=main', childSource]);
  git(childSource, ['config', 'user.name', 'Canary Test']);
  git(childSource, ['config', 'user.email', 'canary@example.invalid']);
  writeFileSync(join(childSource, 'accepted.md'), 'accepted main state\n');
  git(childSource, ['add', 'accepted.md']);
  git(childSource, ['commit', '-m', 'Accepted child state']);
  git(root, ['clone', '--bare', childSource, childBare]);
  git(root, ['init', '--initial-branch=main', parent]);
  git(parent, ['config', 'user.name', 'Canary Test']);
  git(parent, ['config', 'user.email', 'canary@example.invalid']);
  writeFileSync(join(parent, '.gitignore'), '/.decision-os-merge-dev-logs/\n');
  writeFileSync(join(parent, 'README.md'), 'main\n');
  git(parent, ['add', '.gitignore', 'README.md']);
  git(parent, ['commit', '-m', 'Parent main']);
  git(parent, ['-c', 'protocol.file.allow=always', 'submodule', 'add', childBare, '.decision-os']);
  git(parent, ['add', '.gitmodules', '.decision-os']);
  git(parent, ['commit', '-m', 'Add Decision OS child']);
  git(parent, ['tag', 'rel-0.1.0']);
  git(parent, ['branch', 'dev']);
  git(parent, ['switch', '-c', 'candidate', 'dev']);
  writeFileSync(join(parent, 'candidate.ts'), 'export const candidate = true;\n');
  git(parent, ['add', 'candidate.ts']);
  git(parent, ['commit', '-m', 'Candidate source']);
  const mainWorktree = join(root, 'canonical-main-worktree');
  git(parent, ['worktree', 'add', mainWorktree, 'main']);
  git(mainWorktree, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
  return parent;
}

function boundedResult(input: RunBoundedProcessInput, stdout: string): BoundedProcessResult {
  return {
    ok: true,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 123,
    startedAt: '2026-08-07T00:00:00.000Z',
    finishedAt: '2026-08-07T00:00:01.000Z',
    durationMs: 1_000,
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

test('copies the complete registered catalog byte-identically while quarantining authority and preserving symlinks without following', () => {
  const context = fixture();
  try {
    const before = inventoryReleaseCanarySource(context.masterRoot);
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `snapshot-${process.pid}-${Date.now()}`,
      now: () => new Date('2026-08-07T01:00:00.000Z'),
    });
    const nestedLanePath = join('.canary-projects', createHash('sha256').update('nested-project').digest('hex').slice(0, 24));
    assert.equal(manifest.sourceInventory.digest, before.digest);
    assert.equal(manifest.copiedInventory.digest, before.digest);
    assert.equal(manifest.projectCount, 3);
    assert.deepEqual(manifest.projectStates, [
      { projectId: 'ardaria', relativePath: '../ardaria-external', state: 'no-task-state' },
      { projectId: 'nested-project', relativePath: 'projects/nested', state: 'no-task-state' },
      { projectId: 'root-project', relativePath: '.', state: 'task-state' },
    ]);
    assert.deepEqual(manifest.laneProvenance, {
      baseline: 'derived-fresh-incidents',
      candidate: 'derived-fresh-incidents',
      recovery: 'derived-copied-ledger',
    });
    assert.deepEqual(manifest.releaseTopology, { currentPointer: 'current', activeReleaseSha: 'a'.repeat(40), immutableReleaseCount: 1 });
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'master', '.settings.json'), 'utf8'), readFileSync(join(context.masterRoot, '.settings.json'), 'utf8'));
    assert.equal(readlinkSync(join(manifest.snapshotArchiveRoot, 'release', 'current')), `releases/${'a'.repeat(40)}`);
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'release', 'releases', 'a'.repeat(40), 'bin', 'decision-os-server.mjs'), 'utf8'), 'release launcher\n');
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, 'release', 'current'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.lanes.recovery, 'release', 'current'), 'utf8'));
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'master', '.git', 'config'), 'utf8'), 'archive-git-metadata\n');
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'master', 'delivery', 'authority.json'), 'utf8'), '{"credential":"archive-delivery-secret"}\n');
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'projects', 'nested-project', 'nested', '.decision-os', '.settings.json'), 'utf8'), '{"secret":"nested-must-not-copy"}\n');
    assert.equal(readFileSync(join(manifest.snapshotArchiveRoot, 'projects', 'ardaria', 'cards', 'ardaria.md'), 'utf8'), '# Ardaria\n');
    const runnableRegistry = JSON.parse(readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', 'projects.json'), 'utf8')) as { projects: Record<string, { relativePath: string }> };
    assert.equal(runnableRegistry.projects['nested-project']?.relativePath, nestedLanePath);
    assert.equal(readFileSync(join(manifest.lanes.recovery, '.decision-os', 'runtime-incidents.json'), 'utf8'), readFileSync(join(context.masterRoot, 'runtime-incidents.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.lanes.baseline, '.decision-os', 'runtime-incidents.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.lanes.candidate, nestedLanePath, '.decision-os', 'runtime-incidents.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', '.settings.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', 'cache', 'live-cache.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', '.git', 'config'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', 'delivery', 'authority.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, nestedLanePath, '.decision-os', 'nested', '.decision-os', '.settings.json'), 'utf8'));
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, nestedLanePath, '.decision-os', 'nested', '.decision-os', 'runtime', 'process.json'), 'utf8'));
    assert.equal(readlinkSync(join(manifest.snapshotCatalogRoot, nestedLanePath, '.decision-os', 'internal-link')), 'cards/card.md');
    assert.equal(readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', 'migrations', 'retained.json'), 'utf8'), '{"retain":true}\n');
    assert.throws(() => readFileSync(join(manifest.snapshotCatalogRoot, '.decision-os', 'frontend-telemetry.jsonl.rotated-1'), 'utf8'));
    assert.equal(readFileSync(join(manifest.snapshotCatalogRoot, nestedLanePath, '.decision-os', 'task-state', 'nested-project', 'current', 'nested.json'), 'utf8'), '{"nested":true}\n');
    assert.equal(readFileSync(join(manifest.runtimeFixtures.baseline.canaryA, nestedLanePath, '.decision-os', 'task-state', 'nested-project', 'current', 'nested.json'), 'utf8'), '{"nested":true}\n');
    assert.throws(() => readFileSync(join(manifest.runtimeFixtures.baseline.canaryB, nestedLanePath, '.decision-os', 'task-state', 'nested-project', 'current', 'nested.json'), 'utf8'));
    assert.equal(readFileSync(join(manifest.runtimeFixtures.baseline.canaryB, nestedLanePath, '.decision-os', 'cards', 'card.md'), 'utf8'), '# Card\n');
    const sourceOriginHash = createHash('sha256').update('ssh://secret-bearing-source.example/project.git').digest('hex');
    assert.deepEqual(manifest.projectGit.find((entry) => entry.projectId === 'nested-project'), {
      projectId: 'nested-project', sourceOriginPresent: true, sourceOriginHash,
    });
    const scratchConfig = readFileSync(join(manifest.runtimeFixtures.baseline.canaryA, nestedLanePath, '.git', 'config'), 'utf8');
    assert.match(scratchConfig, new RegExp(`https://canary\\.invalid/${sourceOriginHash}\\.git`));
    assert.doesNotMatch(scratchConfig, /secret-bearing-source/);
    const isolatedSettings = JSON.parse(readFileSync(join(manifest.runtimeFixtures.baseline.canaryA, '.decision-os', '.settings.json'), 'utf8')) as Record<string, unknown>;
    assert.match(String(isolatedSettings.federationId), /^release_canary_/);
    assert.match(String(isolatedSettings.federationNodeId), /^baseline_a_/);
    assert.equal(Object.hasOwn(isolatedSettings, 'federationRelayUrl'), false);
    const identityByLane = new Map(manifest.canaryIdentities.map((entry) => [entry.lane, entry]));
    assert.equal(identityByLane.get('baseline-a')?.federationId, identityByLane.get('baseline-b')?.federationId);
    assert.equal(identityByLane.get('candidate-a')?.federationId, identityByLane.get('candidate-b')?.federationId);
    assert.notEqual(identityByLane.get('baseline-a')?.federationId, identityByLane.get('candidate-a')?.federationId);
    assert.notEqual(identityByLane.get('candidate-a')?.federationId, identityByLane.get('recovery')?.federationId);
    const readBack = readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId: manifest.runId });
    assert.equal(readBack.runRoot, manifest.runRoot);
    const serializedManifest = readFileSync(manifest.manifestFile, 'utf8');
    assert.doesNotMatch(serializedManifest, /must-not-copy|archive-delivery-secret|secret-bearing-source/);
    const cleaned = cleanupReleaseCanaryRun({ repositoryRoot: context.repositoryRoot, runId: manifest.runId });
    return cleaned.then((receipt) => assert.deepEqual(receipt, { cleaned: true, runId: manifest.runId, status: 'cleaned' }));
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('rejects a source write during capture and never writes source bytes', async () => {
  const context = fixture();
  const sourceFile = join(context.nestedDecisionOsRoot, 'cards', 'card.md');
  const original = readFileSync(sourceFile, 'utf8');
  const runId = `changing-${process.pid}-${Date.now()}`;
  try {
    assert.throws(() => createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId,
      maximumAttempts: 1,
      afterCopyAttempt: () => writeFileSync(sourceFile, `${original}changed\n`),
    }), (error: unknown) => error instanceof ReleaseCanaryHarnessError && error.code === 'release_canary_source_changed');
    assert.equal(readFileSync(sourceFile, 'utf8'), `${original}changed\n`);
    assert.equal(readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId }).status, 'proof-failed');
    await cleanupReleaseCanaryRun({ repositoryRoot: context.repositoryRoot, runId });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('rejects a settings-owned release-root write during the exact archive capture', async () => {
  const context = fixture();
  const releaseMarker = join(context.releaseRoot, 'release-marker.json');
  const runId = `release-changing-${process.pid}-${Date.now()}`;
  try {
    assert.throws(() => createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId,
      maximumAttempts: 1,
      afterCopyAttempt: () => writeFileSync(releaseMarker, '{"release":"changed"}\n'),
    }), (error: unknown) => error instanceof ReleaseCanaryHarnessError && error.code === 'release_canary_source_changed');
    assert.equal(readFileSync(releaseMarker, 'utf8'), '{"release":"changed"}\n');
    await cleanupReleaseCanaryRun({ repositoryRoot: context.repositoryRoot, runId });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('retains external symlink text in snapshot evidence but rejects every runnable lane', async () => {
  const context = fixture();
  const link = join(context.nestedDecisionOsRoot, 'escaping-link');
  const runId = `symlink-${process.pid}-${Date.now()}`;
  symlinkSync('../../../outside-do-not-follow', link);
  try {
    const inventory = inventoryReleaseCanarySource(context.masterRoot);
    assert.equal(
      inventory.entries.find((entry) => entry.path.endsWith('/escaping-link'))?.linkTargetSha256,
      createHash('sha256').update('../../../outside-do-not-follow').digest('hex'),
    );
    assert.throws(() => createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId,
    }), (error: unknown) => error instanceof ReleaseCanaryHarnessError && error.code === 'release_canary_symlink_escape');
    const failedManifest = readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId });
    assert.equal(failedManifest.status, 'proof-failed');
    assert.equal(readlinkSync(join(failedManifest.snapshotArchiveRoot, 'projects', 'nested-project', 'escaping-link')), '../../../outside-do-not-follow');
    assert.doesNotMatch(readFileSync(failedManifest.manifestFile, 'utf8'), /outside-do-not-follow/);
    await cleanupReleaseCanaryRun({ repositoryRoot: context.repositoryRoot, runId });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('fails closed on external dev Worker drift and retains the complete run', async () => {
  const context = fixture();
  try {
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `drift-${process.pid}-${Date.now()}`,
    });
    recordReleaseCanaryExternalWorker({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      priorVersionId: 'prior-version',
      ownedVersionId: 'owned-version',
    });
    let restoreCalls = 0;
    const receipt = await cleanupReleaseCanaryRun({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      readActiveDevWorkerVersion: async () => 'external-version',
      restoreDevWorkerVersion: async () => { restoreCalls += 1; },
    });
    assert.deepEqual(receipt, { cleaned: false, runId: manifest.runId, status: 'external-worker-drift' });
    assert.equal(restoreCalls, 0);
    assert.equal(readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId: manifest.runId }).runRoot, manifest.runRoot);
    let active = 'owned-version';
    await cleanupReleaseCanaryRun({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      readActiveDevWorkerVersion: async () => active,
      restoreDevWorkerVersion: async (versionId) => { active = versionId; },
    });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('restores only the manifest-recorded prior dev Worker version before local cleanup', async () => {
  const context = fixture();
  try {
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `restore-${process.pid}-${Date.now()}`,
    });
    recordReleaseCanaryExternalWorker({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      priorVersionId: 'prior-version',
      ownedVersionId: 'owned-version',
    });
    let active = 'owned-version';
    const restored: string[] = [];
    const receipt = await cleanupReleaseCanaryRun({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      readActiveDevWorkerVersion: async () => active,
      restoreDevWorkerVersion: async (versionId) => {
        restored.push(versionId);
        active = versionId;
      },
    });
    assert.deepEqual(restored, ['prior-version']);
    assert.deepEqual(receipt, { cleaned: true, runId: manifest.runId, status: 'cleaned' });
    assert.throws(() => readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId: manifest.runId }));
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('rejects manifest tampering before cleanup resolves any deletion target', async () => {
  const context = fixture();
  try {
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `tamper-${process.pid}-${Date.now()}`,
    });
    const tampered = JSON.parse(readFileSync(manifest.manifestFile, 'utf8')) as Record<string, unknown>;
    tampered.status = 'proof-complete';
    writeFileSync(manifest.manifestFile, `${JSON.stringify(tampered, null, 2)}\n`);
    await assert.rejects(cleanupReleaseCanaryRun({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
    }), (error: unknown) => error instanceof ReleaseCanaryHarnessError && error.code === 'release_canary_manifest_authority_invalid');
    assert.equal(readFileSync(join(manifest.runRoot, 'manifest.json'), 'utf8').includes('proof-complete'), true);
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('exposes only prove bump and manifest cleanup inputs', async () => {
  assert.deepEqual(parseDecisionOsReleaseCanaryArguments(['prove', '--bump', 'fix', '--json']), {
    command: 'prove', bump: 'fix', json: true,
  });
  assert.deepEqual(parseDecisionOsReleaseCanaryArguments(['cleanup', '--run-id', 'run-1', '--json']), {
    command: 'cleanup', runId: 'run-1', json: true,
  });
  for (const forbidden of ['--endpoint', '--worker', '--namespace', '--path', '--ref', '--release-root', '--credential']) {
    assert.throws(
      () => parseDecisionOsReleaseCanaryArguments(['prove', '--bump', 'fix', forbidden, 'injected', '--json']),
      (error: unknown) => error instanceof ReleaseCanaryCliError && error.code === 'release_canary_cli_usage',
    );
  }
  const output: string[] = [];
  const runtime: ReleaseCanaryCliRuntime = {
    async prove(bump) {
      return {
        ok: false,
        command: 'prove',
        status: 'release-proven',
        runId: 'run-1',
        receiptId: `sha256:${'a'.repeat(64)}`,
        candidateSha: 'b'.repeat(40),
        bump,
        manifestFile: '/fixed/manifest.json',
        sourceInventory: { digest: 'c'.repeat(64), fileCount: 10, byteCount: 100 },
        release: null,
        phases: {
          snapshot: null,
          'canonical-release': null,
          'delivery-success': null,
          'delivery-resume': null,
          'delivery-rollback': null,
          'watcher-recovery': null,
          'worker-runtime': null,
          'termux-runtime': null,
          'reconnect-quiescence': null,
          'incident-recovery': null,
          'cleanup-readiness': null,
        },
      };
    },
    async cleanup(runId) {
      return { cleaned: true, runId, status: 'cleaned' };
    },
  };
  assert.equal(await runDecisionOsReleaseCanaryCli({
    argv: ['prove', '--bump', 'fix', '--json'], runtime, write: (value) => output.push(value),
  }), 4);
  assert.equal(JSON.parse(output[0]).status, 'release-proven');
  const incompleteRuntime: ReleaseCanaryCliRuntime = {
    ...runtime,
    async prove(bump) {
      const receipt = await runtime.prove(bump);
      const fabricated = { receiptFile: '/fixed/fabricated.json', receiptId: `sha256:${'a'.repeat(64)}` };
      return {
        ...receipt,
        ok: true,
        status: 'proof-complete' as const,
        phases: Object.fromEntries(Object.keys(receipt.phases).map((phase) => [phase, fabricated])) as typeof receipt.phases,
      };
    },
  };
  await assert.rejects(runDecisionOsReleaseCanaryCli({
    argv: ['prove', '--bump', 'fix', '--json'], runtime: incompleteRuntime, write: () => undefined,
  }), (error: unknown) => error instanceof ReleaseCanaryCliError && error.code === 'release_canary_proof_incomplete');
});

test('runs canonical merge and paired-tag resolution only inside manifest-owned local remotes', async () => {
  const context = fixture();
  const repositoryRoot = canonicalRepository(context.root);
  try {
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `git-${process.pid}-${Date.now()}`,
    });
    const receipt = await proveReleaseCanaryGitSandbox({
      repositoryRoot,
      runId: manifest.runId,
      bump: 'fix',
    });
    assert.equal(receipt.mode, 'feature');
    assert.equal(receipt.releaseTag, 'rel-0.1.1');
    assert.equal(receipt.devReleaseTag, 'devrel-0.1.1');
    assert.equal(receipt.releaseSha, receipt.candidateSha);
    assert.equal(receipt.mainFirstParent, receipt.priorMainSha);
    assert.equal(receipt.devSecondParent, receipt.releaseSha);
    assert.equal(receipt.initializedChildHead, receipt.decisionOsSha);
    assert.match(receipt.receiptId, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(readReleaseCanaryManifest({ repositoryRoot, runId: manifest.runId }).release, {
      receiptFile: join(manifest.runRoot, 'release-receipt.json'),
      receiptId: receipt.receiptId,
      candidateSha: receipt.candidateSha,
      mainSha: receipt.mainSha,
      releaseSha: receipt.releaseSha,
      releaseTag: receipt.releaseTag,
    });
    assert.ok(receipt.parentRemote.startsWith(manifest.runRoot));
    assert.ok(receipt.childRemote.startsWith(manifest.runRoot));
    assert.equal(git(repositoryRoot, ['tag', '--list', 'rel-0.1.1']), '');
    await cleanupReleaseCanaryRun({ repositoryRoot, runId: manifest.runId });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('release-bound proof validates one existing rel/devrel pair without minting another release', async () => {
  const context = fixture();
  const featureRepository = canonicalRepository(context.root);
  try {
    const featureManifest = createReleaseCanarySnapshot({
      repositoryRoot: featureRepository,
      sourceMasterRoot: context.masterRoot,
      runId: `published-source-${process.pid}-${Date.now()}`,
    });
    const featureReceipt = await proveReleaseCanaryGitSandbox({
      repositoryRoot: featureRepository,
      runId: featureManifest.runId,
      bump: 'fix',
    });
    const published = join(context.root, 'published-release');
    git(context.root, ['clone', '--branch', featureReceipt.releaseTag, featureReceipt.parentRemote, published]);
    git(published, ['branch', 'main', 'origin/main']);
    const publishedMain = join(context.root, 'published-main');
    git(published, ['worktree', 'add', publishedMain, 'main']);
    git(publishedMain, ['config', 'protocol.file.allow', 'always']);
    git(publishedMain, ['config', 'submodule..decision-os.url', featureReceipt.childRemote]);
    git(publishedMain, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
    const tagsBefore = git(published, ['show-ref', '--tags']);
    const publishedManifest = createReleaseCanarySnapshot({
      repositoryRoot: published,
      sourceMasterRoot: context.masterRoot,
      runId: `published-proof-${process.pid}-${Date.now()}`,
    });
    const receipt = await proveReleaseCanaryGitSandbox({
      repositoryRoot: published,
      runId: publishedManifest.runId,
      bump: 'fix',
    });
    assert.equal(receipt.mode, 'release-bound');
    assert.equal(receipt.merge, null);
    assert.equal(receipt.mainSha, featureReceipt.mainSha);
    assert.equal(receipt.candidateSha, featureReceipt.mainSha);
    assert.equal(receipt.releaseSha, featureReceipt.releaseSha);
    assert.equal(receipt.releaseTag, featureReceipt.releaseTag);
    assert.equal(receipt.devReleaseTag, featureReceipt.devReleaseTag);
    assert.equal(receipt.decisionOsSha, featureReceipt.decisionOsSha);
    assert.equal(receipt.mainStateProof, 'paired-child-tags');
    assert.equal(receipt.mainSentinelSha256, featureReceipt.mainSentinelSha256);
    assert.equal(git(published, ['show-ref', '--tags']), tagsBefore);
    assert.equal(git(published, ['tag', '--list', 'rel-*']).split('\n').filter(Boolean).length, 2);
    await cleanupReleaseCanaryRun({ repositoryRoot: published, runId: publishedManifest.runId });
    await cleanupReleaseCanaryRun({ repositoryRoot: featureRepository, runId: featureManifest.runId });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('default prove path reports complete only with every hash-bound runtime and recovery phase', async () => {
  const context = fixture();
  const repositoryRoot = canonicalRepository(context.root);
  writeFileSync(join(context.masterRoot, '.settings.json'), `${JSON.stringify({
    deliveryDecisionOsRoot: context.masterRoot,
    deliveryRepositoryRoot: repositoryRoot,
    deliveryReleaseRoot: context.releaseRoot,
    unrelatedSecret: 'never-copied',
  })}\n`, { mode: 0o600 });
  try {
    const runtime = createDefaultReleaseCanaryCliRuntime({
      repositoryRoot,
      catalogRoot: context.catalogRoot,
      proveCompletedPhases: async ({ manifest }): Promise<ReleaseCanaryCompletedPhases> => {
        recordReleaseCanaryExternalWorker({
          repositoryRoot,
          runId: manifest.runId,
          priorVersionId: 'prior-version',
          ownedVersionId: 'owned-version',
        });
        recordReleaseCanaryExternalWorkerRestored({
          repositoryRoot,
          runId: manifest.runId,
          priorVersionId: 'prior-version',
          ownedVersionId: 'owned-version',
        });
        return Object.fromEntries([
          'watcher-recovery',
          'worker-runtime',
          'termux-runtime',
          'reconnect-quiescence',
          'incident-recovery',
          'cleanup-readiness',
        ].map((phase) => {
          const receiptFile = join(manifest.runRoot, `${phase}-test-receipt.json`);
          const bytes = `${JSON.stringify({ phase, status: 'passed', evidence: { fixture: true } })}\n`;
          writeFileSync(receiptFile, bytes, { mode: 0o600 });
          return [phase, { receiptFile, receiptId: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }];
        })) as ReleaseCanaryCompletedPhases;
      },
    });
    const receipt = await runtime.prove('fix');
    assert.equal(receipt.ok, true);
    assert.equal(receipt.status, 'proof-complete');
    assert.match(String(receipt.phases.snapshot?.receiptId), /^sha256:[a-f0-9]{64}$/);
    assert.match(String(receipt.phases['canonical-release']?.receiptId), /^sha256:[a-f0-9]{64}$/);
    for (const phase of ['delivery-success', 'delivery-resume', 'delivery-rollback'] as const) {
      const evidence = receipt.phases[phase];
      assert.match(String(evidence?.receiptId), /^sha256:[a-f0-9]{64}$/);
      const artifact = JSON.parse(readFileSync(String(evidence?.receiptFile), 'utf8')) as {
        phase: string;
        status: string;
      };
      assert.equal(artifact.phase, phase);
      assert.equal(artifact.status, 'passed');
    }
    assert.match(String(receipt.phases['worker-runtime']?.receiptId), /^sha256:[a-f0-9]{64}$/);
    assert.match(String(receipt.phases['incident-recovery']?.receiptId), /^sha256:[a-f0-9]{64}$/);
    const output: string[] = [];
    assert.equal(await runDecisionOsReleaseCanaryCli({
      argv: ['prove', '--bump', 'fix', '--json'],
      runtime: {
        ...runtime,
        async prove() {
          return receipt;
        },
      },
      write: (value) => output.push(value),
    }), 0);
    assert.equal(JSON.parse(output[0]).status, 'proof-complete');
    await cleanupReleaseCanaryRun({
      repositoryRoot,
      runId: receipt.runId,
      readActiveDevWorkerVersion: async () => 'prior-version',
      restoreDevWorkerVersion: async () => undefined,
    });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});

test('executes the callable env.dev upload, activation, drift check, and predecessor restoration path', async () => {
  const context = fixture();
  try {
    const manifest = createReleaseCanarySnapshot({
      repositoryRoot: context.repositoryRoot,
      sourceMasterRoot: context.masterRoot,
      runId: `worker-${process.pid}-${Date.now()}`,
    });
    const priorVersionId = '11111111-1111-4111-8111-111111111111';
    const ownedVersionId = '22222222-2222-4222-8222-222222222222';
    let active = priorVersionId;
    const calls: RunBoundedProcessInput[] = [];
    const runner = async (input: RunBoundedProcessInput): Promise<BoundedProcessResult> => {
      calls.push(input);
      const args = input.args ?? [];
      // WHAT: Model the exact external authority transition for the invoked env.dev command.
      // WHY: Offline proof must exercise production parsers and argv without contacting Cloudflare.
      if (args.includes('deploy') && args.includes(`${ownedVersionId}@100%`)) active = ownedVersionId;
      // WHAT: Model rollback only when Wrangler receives the recorded predecessor.
      // WHY: Cleanup proof must confirm that exact version becomes active.
      if (args.includes('rollback') && args.includes(priorVersionId)) active = priorVersionId;
      // WHAT: Return deployment authority for list operations.
      // WHY: Activation and cleanup are accepted only from observed 100-percent traffic state.
      if (args.includes('deployments') && args.includes('list')) {
        return boundedResult(input, JSON.stringify([{
          id: `deployment-${active}`,
          created_on: '2026-08-07T00:00:00.000Z',
          versions: [{ version_id: active, percentage: 100 }],
        }]));
      }
      // WHAT: Return the stable uploaded version identity for upload.
      // WHY: The real upload parser owns the next activation input.
      if (args.includes('upload')) return boundedResult(input, `Worker Version ID: ${ownedVersionId}\n`);
      return boundedResult(input, 'ok\n');
    };
    const environment = { CLOUDFLARE_API_TOKEN: 'offline-secret', CLOUDFLARE_ACCOUNT_ID: 'offline-account' };
    const deployed = await deployReleaseCanaryDevWorker({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      releaseWorktree: resolve(import.meta.dirname, '../../..'),
      mainSha: 'a'.repeat(40),
      environment,
      runner,
      readHealth: async () => ({
        ok: true,
        status: 'ready',
        releaseSha: 'a'.repeat(40),
        deliveryProtocol: 1,
        protocolVersion: 1,
        stateProtocol: taskStateProtocol,
        stateSchema: taskCurrentStateVersion,
        baselineEpoch: taskCurrentBaselineEpoch,
      }),
    });
    assert.equal(deployed.priorVersionId, priorVersionId);
    assert.equal(deployed.ownedVersionId, ownedVersionId);
    assert.deepEqual(readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId: manifest.runId }).externalWorker, {
      priorVersionId, ownedVersionId, restored: false,
    });
    const restored = await restoreReleaseCanaryDevWorker({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      releaseWorktree: resolve(import.meta.dirname, '../../..'),
      failedMainSha: 'a'.repeat(40),
      priorVersionId,
      ownedVersionId,
      environment,
      runner,
    });
    assert.equal(restored.status, 'restored');
    assert.equal(active, priorVersionId);
    assert.equal(readReleaseCanaryManifest({ repositoryRoot: context.repositoryRoot, runId: manifest.runId }).externalWorker?.restored, true);
    assert.equal(calls.every((call) => {
      const args = call.args ?? [];
      return args.includes('--env')
        && args[args.indexOf('--env') + 1] === 'dev'
        && args[args.indexOf('--name') + 1] === 'decision-os-federation-relay-dev';
    }), true);
    await cleanupReleaseCanaryRun({
      repositoryRoot: context.repositoryRoot,
      runId: manifest.runId,
      readActiveDevWorkerVersion: async () => active,
      restoreDevWorkerVersion: async () => assert.fail('already restored Worker must not roll back again'),
    });
  } finally {
    rmSync(context.root, { recursive: true, force: true });
  }
});
