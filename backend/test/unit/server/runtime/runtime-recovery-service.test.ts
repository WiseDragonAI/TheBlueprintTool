/**
 * WHAT: Verifies explicit recovery upgrades legacy publication incidents from exact retained WAL evidence.
 * WHY: rel-0.4.5 incidents contain hashes and coordinates but no publication-bound evidence or relay root.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createRuntimeIncidentLedger } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import { createIncidentSupervisor } from '../../../../src/business/server/runtime/incident-supervisor.js';
import { createRuntimeRecoveryService } from '../../../../src/business/server/runtime/runtime-recovery-service.js';
import { createTaskCurrentStateStore } from '../../../../src/business/task-state/helper/task-current-state-store.js';
import { finalizeTaskCurrentEntity, taskCurrentEntityKey, taskCurrentStateVersion, type TaskRepairCollisionRejection } from '../../../../../shared/task-current-state-core.js';

type Store = ReturnType<typeof createTaskCurrentStateStore>;

async function legacyFixture(prefix: string, retainReceiver = true) {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  const projectId = 'project-a';
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId, initializeLedger: {} });
  const metadata = {
    executionId: 'execution-a', requestId: 'local-request', sessionId: 'session-a', projectId, ledgerId: 'tasks', taskId: 'task-a',
    sourceCardId: 'task-a', ownerCardId: 'task-a', kind: 'thread', requestedAt: '2026-08-09T00:00:00.000Z', model: null,
    effort: null, pipelineRunId: null, pipelineStepId: null, pipelineSkillRunId: null, predecessorExecutionId: null, restartOfExecutionId: null,
  };
  const local = await store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'execution', entityId: 'execution-a', changes: [{ path: 'metadata', operation: 'set', value: metadata }] }] });
  const localEntity = local.delta.entities[0];
  const remoteEntity = finalizeTaskCurrentEntity({
    ...structuredClone(localEntity),
    fields: { ...structuredClone(localEntity.fields), metadata: { ...structuredClone(localEntity.fields.metadata), candidates: [{ ...structuredClone(localEntity.fields.metadata.candidates[0]), value: { ...metadata, requestId: 'relay-request' } }] } },
  });
  let collision: TaskRepairCollisionRejection = {
    code: 'task_current_dot_collision' as const,
    key: taskCurrentEntityKey(localEntity),
    stateHash: localEntity.stateHash,
    receiverStateHash: remoteEntity.stateHash,
    collisions: [{ entityType: 'execution', entityId: 'execution-a', path: 'metadata', dot: structuredClone(localEntity.fields.metadata.candidates[0].dot) }],
  };
  // WHAT: Retain the complete relay receiver bytes only for the positive legacy-upgrade fixture.
  // WHY: The negative fixture must prove that incident hashes alone cannot create recovery authority.
  if (retainReceiver) {
    await store.mergeRepairGroup([{ attemptId: 'prior-repair', deliveryId: 'prior-delivery', delta: { version: taskCurrentStateVersion, projectId, entities: [remoteEntity] } }], 'prior-repair');
    collision = { ...collision, collisions: structuredClone(store.repairCollisionEvidence('prior-repair')[0].collisions) };
    store.resumeMaterialization('prior-repair');
    await store.flush();
  }
  return { root, projectId, store, localEntity, remoteEntity, collision };
}

function recoveryHarness(fixture: Awaited<ReturnType<typeof legacyFixture>>, collision = fixture.collision) {
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: fixture.root });
  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  const scope = `federation-repair:${fixture.projectId}`;
  const deliveryId = 'legacy-delivery';
  const attemptId = `publication:${deliveryId}`;
  const relayRoot = 'a'.repeat(64);
  const noProgressAttempt = `${relayRoot}:${fixture.store.rootHash()}`;
  const noProgress = incidentLedger.record({
    scope: `project-task-state:${fixture.projectId}`,
    component: 'federation-task-state-replicator',
    operation: 'synchronize-federated-state',
    code: 'federation_state_no_progress',
    error: new Error(`Federated state made no durable progress for ${fixture.projectId}.`),
    context: { projectId: fixture.projectId, from: 'relay', attemptId: noProgressAttempt },
  });
  incidentSupervisor.pausedTaskProjects.set(fixture.projectId, noProgress);
  const paused = incidentLedger.record({
    scope,
    component: 'federation-task-state-replicator',
    operation: 'terminal-state-collision',
    code: 'task_current_dot_collision',
    error: new Error(`task_current_dot_collision:${fixture.projectId}`),
    context: { projectId: fixture.projectId, from: 'relay', attemptId, deliveryId, rejected: [collision], evidenceKeys: [] },
  });
  incidentSupervisor.pausedFederationRepairs.set(fixture.projectId, paused);
  const publications: Array<{ keys: string[]; root: string; incidentContext: Record<string, unknown> }> = [];
  let converged = false;
  const replicator = {
    diagnostics: () => ({
      convergence: converged ? [{ peerId: 'relay', projectId: fixture.projectId, converged: true }] : [],
      runtimeDirty: [],
    }),
    publishRecoveryDelta: (delta: { entities: Array<{ entityType: string; entityId: string }> }, store: Store) => {
      publications.push({
        keys: delta.entities.map((entity) => `${entity.entityType}\u0000${entity.entityId}`),
        root: store.rootHash(),
        incidentContext: structuredClone(incidentLedger.active(scope)[0]?.context ?? {}),
      });
      converged = true;
    },
    restoreTerminalRepair: () => undefined,
    clearTerminalRepair: () => undefined,
  };
  const project = { id: fixture.projectId, name: 'Project A', relativePath: '.', root: fixture.root, decisionOsRoot: fixture.root, description: '', color: '#38d9e8', ledgers: [], available: true, diagnostic: '' };
  const input = {
    codexCoordinator: { schedule: async () => undefined },
    contentObjectRoots: [],
    contentScheduler: () => null,
    federatedLibrary: {},
    federation: {},
    federatedTaskRuntime: { executionStates: new Map(), projectStates: new Map(), taskStores: new Map() },
    incidentLedger,
    incidentSupervisor,
    initializePipelineCatalog: () => undefined,
    invalidateProject: () => undefined,
    localNodeId: () => 'workstation',
    localTaskRuntime: { states: new Map([[fixture.projectId, { store: fixture.store }]]) },
    migrationAdmissionFile: resolve(fixture.root, 'migration-admission.json'),
    migrateProjectPipelines: () => undefined,
    projectById: (projectId: string) => projectId === fixture.projectId ? project : null,
    projectRuntimeRegistry: { contexts: new Map(), dispose: () => undefined },
    projectSyncRuntime: {},
    replicator: () => replicator,
  } as unknown as Parameters<typeof createRuntimeRecoveryService>[0];
  return { attemptId, incidentLedger, incidentSupervisor, publications, recovery: createRuntimeRecoveryService(input), scope };
}

test('explicit recovery upgrades one legacy publication incident from retained WAL evidence and settles both pauses', async (context) => {
  const fixture = await legacyFixture('decision-os-legacy-publication-recovery-');
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const harness = recoveryHarness(fixture);
  assert.deepEqual(fixture.store.repairCollisionEvidence(harness.attemptId), []);

  const result = await harness.recovery.resume(harness.scope, 'reconcile-local-authority');

  assert.equal(result.ok, true);
  assert.equal(harness.publications.length, 1);
  assert.deepEqual(harness.publications[0].keys, [taskCurrentEntityKey(fixture.localEntity)]);
  assert.equal(harness.publications[0].incidentContext.relayRoot, 'a'.repeat(64));
  assert.deepEqual(harness.publications[0].incidentContext.evidenceKeys, [`legacy-delivery\u0000${taskCurrentEntityKey(fixture.localEntity)}`]);
  const evidence = fixture.store.repairCollisionEvidence(harness.attemptId);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].direction, 'publication');
  assert.equal(evidence[0].localEntity.stateHash, fixture.localEntity.stateHash);
  assert.equal(evidence[0].remoteEntity.stateHash, fixture.remoteEntity.stateHash);
  assert.equal(harness.incidentLedger.active(harness.scope).length, 0);
  assert.equal(harness.incidentLedger.active(`project-task-state:${fixture.projectId}`).length, 0);
  const reopenedIncidents = createRuntimeIncidentLedger({ decisionOsRoot: fixture.root }).snapshot().incidents;
  const upgradedIncident = reopenedIncidents.find((incident) => incident.scope === harness.scope && incident.code === 'task_current_dot_collision');
  assert.equal(upgradedIncident?.context.relayRoot, 'a'.repeat(64));
  assert.deepEqual(upgradedIncident?.context.evidenceKeys, [`legacy-delivery\u0000${taskCurrentEntityKey(fixture.localEntity)}`]);
  await fixture.store.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: fixture.root, projectId: fixture.projectId });
  assert.deepEqual(restarted.repairCollisionEvidence(harness.attemptId), evidence);
  const receipt = await restarted.recoverRepairCollisionLocalAuthority(harness.attemptId);
  assert.equal(receipt.attemptId, harness.attemptId);
  assert.notEqual(receipt.resultingStateHashes[taskCurrentEntityKey(fixture.localEntity)], fixture.localEntity.stateHash);

  const repeated = await harness.recovery.resume(harness.scope, 'reconcile-local-authority');
  assert.equal(repeated.ok, false);
  assert.equal(harness.publications.length, 1);
});

test('legacy publication recovery preserves its incident when the exact receiver archive is missing', async (context) => {
  const fixture = await legacyFixture('decision-os-legacy-publication-missing-', false);
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const harness = recoveryHarness(fixture);
  await assert.rejects(harness.recovery.resume(harness.scope, 'reconcile-local-authority'), /task_current_publication_collision_archive_missing/);
  assert.equal(harness.incidentLedger.active(harness.scope).length, 1);
  assert.deepEqual(fixture.store.repairCollisionEvidence(harness.attemptId), []);
  assert.deepEqual(harness.publications, []);
});

test('legacy publication recovery rejects malformed collision coordinates before durable adoption', async (context) => {
  const fixture = await legacyFixture('decision-os-legacy-publication-malformed-');
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const malformed = { ...fixture.collision, collisions: [{ ...fixture.collision.collisions[0], path: 'lifecycle' }] };
  const harness = recoveryHarness(fixture, malformed);
  await assert.rejects(harness.recovery.resume(harness.scope, 'reconcile-local-authority'), /invalid_task_current_publication_collision_evidence/);
  assert.equal(harness.incidentLedger.active(harness.scope).length, 1);
  assert.deepEqual(fixture.store.repairCollisionEvidence(harness.attemptId), []);
  assert.deepEqual(harness.publications, []);
});
