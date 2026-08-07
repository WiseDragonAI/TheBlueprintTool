/**
 * WHAT: Proves complete multi-project production-state archive and independent scratch restoration.
 * WHY: Recovery admission must include master state, registered external Ardaria state, and complete release authority.
 */
import assert from 'node:assert/strict';
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  prepareProductionStateBackup,
  ProductionStateBackupError,
  verifyProductionStateBackup,
} from '../../src/business/recovery/helper/production-state-backup.js';
import { runDecisionOsProductionStateBackupCli } from '../../src/cli/decision-os-production-state-backup.js';
import { createTaskCurrentStateStore } from '../../src/business/task-state/helper/task-current-state-store.js';

const internalProjectId = 'internal-project';
const ardariaProjectId = 'ardaria-project';
const activeReleaseSha = 'a'.repeat(40);
const priorReleaseSha = 'b'.repeat(40);

function release(root: string, releaseSha: string): void {
  const releaseRoot = resolve(root, 'releases', releaseSha);
  mkdirSync(resolve(releaseRoot, 'bin'), { recursive: true });
  writeFileSync(resolve(releaseRoot, '.decision-os-release.json'), `${JSON.stringify({
    protocol: 1,
    releaseSha,
    launcher: 'bin/decision-os-server.mjs',
  })}\n`, { mode: 0o444 });
  writeFileSync(resolve(releaseRoot, 'bin', 'decision-os-server.mjs'), '#!/usr/bin/env node\n', { mode: 0o755 });
  writeFileSync(resolve(releaseRoot, 'immutable-source.js'), `export const release = '${releaseSha}';\n`);
}

function project(input: { root: string; id: string; name: string; replicaId: string }): void {
  const decisionOsRoot = resolve(input.root, '.decision-os');
  mkdirSync(resolve(decisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(resolve(decisionOsRoot, 'empty-retained-directory'), { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'project.json'), `${JSON.stringify({ id: input.id, name: input.name })}\n`);
  writeFileSync(resolve(decisionOsRoot, 'state.json'), '{"ledgers":[]}\n');
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), '{"cards":[],"annotations":[],"relationships":[]}\n');
  writeFileSync(resolve(decisionOsRoot, 'cards', 'card.md'), `# ${input.name}\n`);
  createTaskCurrentStateStore({
    decisionOsRoot,
    projectId: input.id,
    initializeLedger: { cards: [], annotations: [], relationships: [] },
    initializeReplica: { replicaId: input.replicaId, counter: 1 },
  });
  chmodSync(resolve(decisionOsRoot, 'empty-retained-directory'), 0o500);
}

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-production-state-backup-test-'));
  const catalogRoot = resolve(root, 'catalog');
  const masterDecisionOsRoot = resolve(catalogRoot, '.decision-os');
  const internalRoot = resolve(catalogRoot, 'projects', 'internal');
  const ardariaLexicalRoot = resolve(catalogRoot, 'Ardaria_57');
  const ardariaCanonicalRoot = resolve(root, 'mounted-ardaria', 'Ardaria_57');
  const releaseRoot = resolve(root, 'production-releases');
  const backupDirectory = resolve(root, 'retained-production-backup');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  mkdirSync(internalRoot, { recursive: true });
  mkdirSync(ardariaCanonicalRoot, { recursive: true });
  project({ root: internalRoot, id: internalProjectId, name: 'Internal', replicaId: 'internal-node' });
  project({ root: ardariaCanonicalRoot, id: ardariaProjectId, name: 'Ardaria', replicaId: 'ardaria-node' });
  symlinkSync(ardariaCanonicalRoot, ardariaLexicalRoot);
  writeFileSync(resolve(ardariaCanonicalRoot, '.decision-os', 'unregistered-link'), '/outside/not-read', { flag: 'w' });
  rmSync(resolve(ardariaCanonicalRoot, '.decision-os', 'unregistered-link'));
  symlinkSync('/outside/not-read', resolve(ardariaCanonicalRoot, '.decision-os', 'unregistered-link'));
  mkdirSync(resolve(masterDecisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(resolve(masterDecisionOsRoot, 'runtime'), { recursive: true });
  mkdirSync(resolve(masterDecisionOsRoot, 'delivery', 'nodes'), { recursive: true });
  mkdirSync(resolve(masterDecisionOsRoot, 'cache'), { recursive: true });
  writeFileSync(resolve(masterDecisionOsRoot, 'cards', 'system.md'), '# System state\n');
  writeFileSync(resolve(masterDecisionOsRoot, 'runtime', 'epoch-4-migration-admission.json'), '{"status":"accepted"}\n');
  writeFileSync(resolve(masterDecisionOsRoot, 'delivery', 'nodes', 'receipt.json'), '{"status":"ready"}\n');
  writeFileSync(resolve(masterDecisionOsRoot, 'cache', 'retained-invalid.json'), '{invalid durable bytes\n');
  writeFileSync(resolve(masterDecisionOsRoot, 'runtime-incidents.json'), '{"version":2,"incidents":[]}\n');
  writeFileSync(resolve(masterDecisionOsRoot, 'projects.json'), `${JSON.stringify({
    version: 2,
    projects: {
      [internalProjectId]: {
        id: internalProjectId,
        relativePath: 'projects/internal',
        name: 'Internal',
        description: '',
        color: '#111111',
        registeredAt: '2026-08-07T00:00:00.000Z',
        cardId: 'card-internal',
      },
      [ardariaProjectId]: {
        id: ardariaProjectId,
        relativePath: 'Ardaria_57',
        name: 'Ardaria',
        description: '',
        color: '#222222',
        registeredAt: '2026-08-07T00:00:00.000Z',
        cardId: 'card-ardaria',
      },
    },
  }, null, 2)}\n`);
  release(releaseRoot, priorReleaseSha);
  release(releaseRoot, activeReleaseSha);
  symlinkSync(`releases/${activeReleaseSha}`, resolve(releaseRoot, 'current'));
  const settingsFile = resolve(masterDecisionOsRoot, '.settings.json');
  writeFileSync(settingsFile, `${JSON.stringify({
    deliveryDecisionOsRoot: masterDecisionOsRoot,
    deliveryReleaseRoot: releaseRoot,
    deliveryCurrentPointer: resolve(releaseRoot, 'current'),
    federationNodeCredential: 'opaque-secret-must-stay-in-file',
  })}\n`, { mode: 0o600 });
  return {
    root,
    catalogRoot,
    masterDecisionOsRoot,
    internalRoot,
    ardariaLexicalRoot,
    ardariaCanonicalRoot,
    releaseRoot,
    backupDirectory,
    settingsFile,
  };
}

function cleanup(context: ReturnType<typeof fixture>): void {
  rmSync(context.root, { recursive: true, force: true });
}

test('archives and independently restores complete registered production state', async () => {
  const context = fixture();
  try {
    const sourceSecretBytes = readFileSync(context.settingsFile);
    const manifest = await prepareProductionStateBackup({
      backupDirectory: context.backupDirectory,
      settingsFile: context.settingsFile,
      now: () => new Date('2026-08-07T01:02:03.000Z'),
      availableBytes: 1_000_000_000n,
    });
    assert.equal(manifest.status, 'verified');
    assert.equal(manifest.projectCount, 2);
    assert.equal(manifest.sourceRootHash, manifest.archiveRootHash);
    assert.equal(manifest.sourceRootHash, manifest.restoredRootHash);
    assert.equal(manifest.release.releaseSha, activeReleaseSha);
    assert.equal(manifest.restoration.ready, true);
    assert.equal(manifest.retention.automaticDeletionPermitted, false);
    assert.equal((lstatSync(context.backupDirectory).mode & 0o777), 0o700);
    assert.equal((lstatSync(manifest.manifestFile).mode & 0o777), 0o600);
    const ardaria = manifest.projects.find((entry) => entry.id === ardariaProjectId);
    assert.ok(ardaria);
    assert.deepEqual(readFileSync(resolve(context.backupDirectory, 'state', 'master', '.settings.json')), sourceSecretBytes);
    assert.equal(readFileSync(resolve(context.backupDirectory, 'state', 'master', 'cache', 'retained-invalid.json'), 'utf8'), '{invalid durable bytes\n');
    assert.equal(readFileSync(resolve(manifest.restoration.restoreRoot, 'catalog', '.decision-os', 'cards', 'system.md'), 'utf8'), '# System state\n');
    assert.equal(lstatSync(resolve(ardaria!.restoredDecisionOsRoot, 'empty-retained-directory')).mode & 0o777, 0o500);
    assert.equal(readFileSync(resolve(manifest.restoration.restoreRoot, 'release', 'releases', priorReleaseSha, 'immutable-source.js'), 'utf8').includes(priorReleaseSha), true);
    assert.equal(readlinkSync(resolve(manifest.restoration.restoreRoot, 'release', 'current')), `releases/${activeReleaseSha}`);
    assert.equal(ardaria?.lexicalType, 'symlink');
    assert.equal(ardaria?.canonicalProjectRoot, context.ardariaCanonicalRoot);
    assert.equal(readlinkSync(resolve(ardaria!.restoredDecisionOsRoot, 'unregistered-link')), '/outside/not-read');
    assert.deepEqual(manifest.taskState.map((entry) => entry.projectId).sort(), [ardariaProjectId, internalProjectId]);
    const verified = await verifyProductionStateBackup({ backupDirectory: context.backupDirectory });
    assert.equal(verified.backupId, manifest.backupId);
  } finally {
    cleanup(context);
  }
});

test('rejects a torn complete source and preserves the changed source bytes', async () => {
  const context = fixture();
  try {
    const source = resolve(context.masterDecisionOsRoot, 'cards', 'system.md');
    await assert.rejects(
      prepareProductionStateBackup({
        backupDirectory: context.backupDirectory,
        settingsFile: context.settingsFile,
        availableBytes: 1_000_000_000n,
        afterCopy: () => writeFileSync(source, '# Changed during copy\n'),
      }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_source_changed',
    );
    assert.equal(readFileSync(source, 'utf8'), '# Changed during copy\n');
  } finally {
    cleanup(context);
  }
});

test('independent verification rejects changed archive and restored bytes', async () => {
  const archiveContext = fixture();
  try {
    await prepareProductionStateBackup({
      backupDirectory: archiveContext.backupDirectory,
      settingsFile: archiveContext.settingsFile,
      availableBytes: 1_000_000_000n,
    });
    writeFileSync(resolve(archiveContext.backupDirectory, 'state', 'master', 'cards', 'system.md'), '# Tampered archive\n');
    await assert.rejects(
      verifyProductionStateBackup({ backupDirectory: archiveContext.backupDirectory }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_archive_changed',
    );
  } finally {
    cleanup(archiveContext);
  }

  const restoreContext = fixture();
  try {
    const manifest = await prepareProductionStateBackup({
      backupDirectory: restoreContext.backupDirectory,
      settingsFile: restoreContext.settingsFile,
      availableBytes: 1_000_000_000n,
    });
    writeFileSync(resolve(manifest.restoration.restoreRoot, 'catalog', '.decision-os', 'cards', 'system.md'), '# Tampered restore\n');
    await assert.rejects(
      verifyProductionStateBackup({ backupDirectory: restoreContext.backupDirectory }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_restore_changed',
    );
  } finally {
    cleanup(restoreContext);
  }
});

test('verification derives restore paths and rejects manifest owner redirection', async () => {
  const restoreRootContext = fixture();
  try {
    const manifest = await prepareProductionStateBackup({
      backupDirectory: restoreRootContext.backupDirectory,
      settingsFile: restoreRootContext.settingsFile,
      availableBytes: 1_000_000_000n,
    });
    manifest.restoration.restoreRoot = resolve(restoreRootContext.root, 'attacker-selected-restore-root');
    writeFileSync(manifest.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      verifyProductionStateBackup({ backupDirectory: restoreRootContext.backupDirectory }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_restore_root_invalid',
    );
  } finally {
    cleanup(restoreRootContext);
  }

  const projectPathContext = fixture();
  try {
    const manifest = await prepareProductionStateBackup({
      backupDirectory: projectPathContext.backupDirectory,
      settingsFile: projectPathContext.settingsFile,
      availableBytes: 1_000_000_000n,
    });
    manifest.projects[0]!.restoredDecisionOsRoot = resolve(projectPathContext.root, 'attacker-selected-project-state');
    writeFileSync(manifest.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      verifyProductionStateBackup({ backupDirectory: projectPathContext.backupDirectory }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_project_topology_invalid',
    );
  } finally {
    cleanup(projectPathContext);
  }

  const duplicateOwnerContext = fixture();
  try {
    const manifest = await prepareProductionStateBackup({
      backupDirectory: duplicateOwnerContext.backupDirectory,
      settingsFile: duplicateOwnerContext.settingsFile,
      availableBytes: 1_000_000_000n,
    });
    manifest.restoredInventories[1]!.owner = manifest.restoredInventories[0]!.owner;
    manifest.restoredInventories[1]!.archiveRelative = manifest.restoredInventories[0]!.archiveRelative;
    writeFileSync(manifest.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      verifyProductionStateBackup({ backupDirectory: duplicateOwnerContext.backupDirectory }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_inventory_owners_invalid',
    );
  } finally {
    cleanup(duplicateOwnerContext);
  }
});

test('CLI exposes only prepare and verify and emits no secret contents', async () => {
  const context = fixture();
  try {
    const output: string[] = [];
    assert.equal(await runDecisionOsProductionStateBackupCli({
      argv: ['prepare', '--backup-directory', context.backupDirectory, '--json'],
      settingsFile: context.settingsFile,
      write: (value) => output.push(value),
    }), 0);
    const receipt = JSON.parse(output[0]!) as Record<string, unknown>;
    assert.equal(receipt.ok, true);
    assert.equal(receipt.projectCount, 2);
    assert.equal(receipt.restorationReady, true);
    assert.doesNotMatch(output[0]!, /opaque-secret/);
    await assert.rejects(
      runDecisionOsProductionStateBackupCli({ argv: ['reset', '--backup-directory', context.backupDirectory, '--json'], write: () => undefined }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_cli_usage',
    );
    await assert.rejects(
      runDecisionOsProductionStateBackupCli({ argv: ['verify', '--backup-directory', context.backupDirectory, '--delete', '--json'], write: () => undefined }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_cli_usage',
    );
  } finally {
    cleanup(context);
  }
});

test('rejects a destination inside the production catalog and insufficient retained-copy capacity', async () => {
  const inside = fixture();
  try {
    await assert.rejects(
      prepareProductionStateBackup({
        backupDirectory: resolve(inside.catalogRoot, 'unsafe-backup'),
        settingsFile: inside.settingsFile,
        availableBytes: 1_000_000_000n,
      }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_not_external',
    );
  } finally {
    cleanup(inside);
  }
  const capacity = fixture();
  try {
    await assert.rejects(
      prepareProductionStateBackup({
        backupDirectory: capacity.backupDirectory,
        settingsFile: capacity.settingsFile,
        availableBytes: 1n,
      }),
      (error: unknown) => error instanceof ProductionStateBackupError && error.code === 'production_state_backup_capacity_insufficient',
    );
  } finally {
    cleanup(capacity);
  }
});
