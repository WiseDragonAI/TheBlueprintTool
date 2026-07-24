/**
 * WHAT: Verifies node-wide offline migration orchestration and identity admission.
 * WHY: Every registered project must convert under the configured federation node identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { migrateNodeTaskCurrentState, planNodeTaskCurrentStateMigration } from '../../../src/business/task-state/controller/migrate-node-task-current-state.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

test('node migrator converts every registered project and writes one offline report', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-migration-'));
  const backupRoot = `${catalogRoot}-backup`;
  context.after(() => [catalogRoot, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const masterDecisionOsRoot = resolve(catalogRoot, '.decision-os');
  const decisionOsRoot = resolve(catalogRoot, 'project-a', '.decision-os');
  mkdirSync(resolve(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  writeFileSync(resolve(masterDecisionOsRoot, 'projects.json'), JSON.stringify({ version: 2, projects: {
    'project-a': { id: 'project-a', relativePath: 'project-a', name: 'Project A', description: '', color: '#38d9e8', registeredAt: '2026-07-22T00:00:00.000Z', cardId: 'project-card:project-a' },
  } }));
  writeFileSync(resolve(masterDecisionOsRoot, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation', nodeCredential: 'local-secret' }));
  writeFileSync(resolve(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a' }));
  writeFileSync(resolve(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }], annotations: [], relationships: [] }));
  writeFileSync(resolve(decisionOsRoot, 'cards', 'tasks', 'card-a.md'), 'Local card body.\n');

  const plan = await planNodeTaskCurrentStateMigration({ catalogRoot, nodeId: 'workstation', targetEpoch: 4, defaultAssignedNodeId: 'workstation' });
  assert.equal(plan.projectCount, 1);
  assert.equal(plan.projects[0].sourceFingerprint.length, 64);
  assert.equal(existsSync(backupRoot), false);

  const result = await migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  });

  assert.equal(result.nodeId, 'workstation');
  assert.deepEqual(result.projects.map((project) => project.projectId), ['project-a']);
  assert.equal(existsSync(resolve(backupRoot, 'catalog-decision-os', '.settings.json')), false);
  assert.equal(existsSync(resolve(backupRoot, 'source-manifest.json')), true);
  assert.equal(JSON.parse(readFileSync(resolve(backupRoot, 'node-migration-report.json'), 'utf8')).projects.length, 1);
  const store = createTaskCurrentStateStore({ decisionOsRoot, projectId: 'project-a' });
  assert.equal((store.projection().ledger.cards as Array<{ id: string }>)[0].id, 'card-a');
  assert.equal(store.contentHeads('.decision-os/cards/tasks/card-a.md')[0].sourceReplicaId, 'workstation');
});

test('node migrator resolves reachable remote objects from the node federation cache', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-cached-object-'));
  const backupRoot = `${catalogRoot}-backup`;
  context.after(() => [catalogRoot, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const masterDecisionOsRoot = resolve(catalogRoot, '.decision-os');
  const decisionOsRoot = resolve(catalogRoot, projectId, '.decision-os');
  const stateRoot = resolve(decisionOsRoot, 'task-state', projectId);
  const bytes = Buffer.from('phone-owned cached object');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const key = '.decision-os/files/phone-owned.bin';
  const cacheFile = resolve(masterDecisionOsRoot, 'cache', 'federation-content-current', 'objects', hash.slice(0, 2), hash);
  mkdirSync(resolve(stateRoot, 'current', 'resource'), { recursive: true });
  mkdirSync(resolve(cacheFile, '..'), { recursive: true });
  writeFileSync(resolve(masterDecisionOsRoot, 'projects.json'), JSON.stringify({ version: 2, projects: {
    [projectId]: { id: projectId, relativePath: projectId, name: 'Project A', description: '', color: '#38d9e8', registeredAt: '2026-07-22T00:00:00.000Z', cardId: `project-card:${projectId}` },
  } }));
  writeFileSync(resolve(masterDecisionOsRoot, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  writeFileSync(resolve(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  writeFileSync(resolve(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(resolve(stateRoot, 'format.json'), JSON.stringify({ version: 3, projectId, baselineRoot: 'legacy' }));
  writeFileSync(resolve(stateRoot, 'current', 'resource', 'phone-owned.json'), JSON.stringify({
    version: 3, projectId, entityType: 'resource', entityId: key, replication: 'active', stateHash: 'legacy',
    fields: { head: { clock: { phone: 1 }, candidates: [{ dot: { replicaId: 'phone', counter: 1 }, operation: 'set', value: { type: 'managed-asset', key, hash, bytes: bytes.byteLength, changedAt: '2026-07-21T00:00:00.000Z' } }] } },
  }));
  writeFileSync(cacheFile, bytes);

  const result = await migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  });

  assert.deepEqual(readFileSync(resolve(result.projects[0].root, 'objects', hash.slice(0, 2), hash)), bytes);
  const sourceManifest = JSON.parse(readFileSync(resolve(backupRoot, 'source-manifest.json'), 'utf8')) as {
    entries: Array<{ file: string; hash: string; archiveFile: string }>;
  };
  assert.equal(sourceManifest.entries.find((entry) => entry.file === cacheFile && entry.hash === hash)?.archiveFile, '');
});

test('node migrator rejects a node identity that differs from federation settings', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-identity-'));
  context.after(() => rmSync(catalogRoot, { recursive: true, force: true }));
  mkdirSync(resolve(catalogRoot, '.decision-os'), { recursive: true });
  writeFileSync(resolve(catalogRoot, '.decision-os', '.settings.json'), JSON.stringify({ federationNodeId: 'phone' }));
  await assert.rejects(migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
  }), /node_task_migration_node_identity_mismatch/);
});

test('node preflight validates every project before creating backup or changing the first project', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-preflight-'));
  const backupRoot = `${catalogRoot}-backup`;
  context.after(() => [catalogRoot, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const master = resolve(catalogRoot, '.decision-os');
  mkdirSync(master, { recursive: true });
  writeFileSync(resolve(master, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  writeFileSync(resolve(master, 'projects.json'), JSON.stringify({ version: 2, projects: Object.fromEntries(['project-a', 'project-b'].map((id) => [id, {
    id, relativePath: id, name: id, description: '', color: '#38d9e8', registeredAt: '2026-07-22T00:00:00.000Z', cardId: `project-card:${id}`,
  }])) }));
  for (const id of ['project-a', 'project-b']) {
    const root = resolve(catalogRoot, id, '.decision-os');
    mkdirSync(root, { recursive: true });
    writeFileSync(resolve(root, 'project.json'), JSON.stringify({ id }));
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
    writeFileSync(resolve(root, 'tasks.json'), JSON.stringify({
      cards: [{ id: `${id}-card`, title: id }],
      annotations: [],
      relationships: id === 'project-b' ? [{ id: 'broken', from: `${id}-card`, to: 'missing', label: 'subtask' }] : [],
    }));
  }
  const firstTasks = readFileSync(resolve(catalogRoot, 'project-a', '.decision-os', 'tasks.json'));

  await assert.rejects(migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  }), /invalid_subtask_relationships:broken/);

  assert.deepEqual(readFileSync(resolve(catalogRoot, 'project-a', '.decision-os', 'tasks.json')), firstTasks);
  assert.equal(existsSync(resolve(catalogRoot, 'project-a', '.decision-os', 'task-state', 'project-a', 'format.json')), false);
  assert.equal(existsSync(backupRoot), false);
});

test('node migration admits an identity-verified project registered through an external symlink', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-symlink-catalog-'));
  const externalRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-symlink-project-'));
  const backupRoot = `${catalogRoot}-backup`;
  context.after(() => [catalogRoot, externalRoot, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const master = resolve(catalogRoot, '.decision-os');
  const decisionOsRoot = resolve(externalRoot, '.decision-os');
  mkdirSync(master, { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  symlinkSync(externalRoot, resolve(catalogRoot, 'external-project'));
  writeFileSync(resolve(master, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  writeFileSync(resolve(master, 'projects.json'), JSON.stringify({ version: 2, projects: {
    'external-project': { id: 'external-project', relativePath: 'external-project', name: 'External', description: '', color: '#38d9e8', registeredAt: '2026-07-22T00:00:00.000Z', cardId: 'project-card:external-project' },
  } }));
  writeFileSync(resolve(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'external-project' }));
  writeFileSync(resolve(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [] }));

  const result = await migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  });

  assert.equal(result.projects[0].relativePath, 'external-project');
  assert.equal(JSON.parse(readFileSync(resolve(decisionOsRoot, 'task-state', 'external-project', 'format.json'), 'utf8')).stateSchema, 4);
});

test('node migration refuses to start while a catalog-owned server process is live', async (context) => {
  const catalogRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-node-online-'));
  const backupRoot = `${catalogRoot}-backup`;
  context.after(() => [catalogRoot, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const master = resolve(catalogRoot, '.decision-os');
  const decisionOsRoot = resolve(catalogRoot, 'project-a', '.decision-os');
  mkdirSync(master, { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(resolve(master, '.settings.json'), JSON.stringify({ federationNodeId: 'workstation' }));
  writeFileSync(resolve(master, 'projects.json'), JSON.stringify({ version: 2, projects: {
    'project-a': { id: 'project-a', relativePath: 'project-a', name: 'Project A', description: '', color: '#38d9e8', registeredAt: '2026-07-22T00:00:00.000Z', cardId: 'project-card:project-a' },
  } }));
  writeFileSync(resolve(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'project-a' }));
  writeFileSync(resolve(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const server = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'decision-os-server'], { cwd: catalogRoot, stdio: 'ignore' });
  await once(server, 'spawn');
  context.after(() => { server.kill('SIGTERM'); });

  await assert.rejects(migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  }), /node_task_migration_server_online/);
  assert.equal(existsSync(backupRoot), false);
});
