/**
 * WHAT: Verifies node-wide offline migration orchestration and identity admission.
 * WHY: Every registered project must convert under the configured federation node identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { migrateNodeTaskCurrentState } from '../../../src/business/task-state/controller/migrate-node-task-current-state.js';
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

  const result = await migrateNodeTaskCurrentState({
    catalogRoot,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    backupRoot,
  });

  assert.equal(result.nodeId, 'workstation');
  assert.deepEqual(result.projects.map((project) => project.projectId), ['project-a']);
  assert.equal(existsSync(resolve(backupRoot, 'catalog-decision-os', '.settings.json')), true);
  assert.equal(JSON.parse(readFileSync(resolve(backupRoot, 'node-migration-report.json'), 'utf8')).projects.length, 1);
  const store = createTaskCurrentStateStore({ decisionOsRoot, projectId: 'project-a' });
  assert.equal((store.projection().ledger.cards as Array<{ id: string }>)[0].id, 'card-a');
  assert.equal(store.contentHeads('.decision-os/cards/tasks/card-a.md')[0].sourceReplicaId, 'workstation');
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
