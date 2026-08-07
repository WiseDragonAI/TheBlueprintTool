/**
 * WHAT: Proves explicit federation repair recovery reconstructs a restart-lost pause from the durable incident.
 * WHY: Coordinator restart must not bypass rejection validation before the incident is resolved.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createRuntimeRecoveryService } from '../../../../src/business/server/runtime/runtime-recovery-service.js';
import { createRuntimeIncidentLedger } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import { createIncidentSupervisor } from '../../../../src/business/server/runtime/incident-supervisor.js';

test('restart hydrates federation repair pause without pausing the project store', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-federation-incident-'));
  try {
    const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: root, file: resolve(root, 'incidents.json') });
    incidentLedger.record({
      scope: 'federation-repair:project-a',
      component: 'federation-task-state-replicator',
      operation: 'terminal-state-rejection',
      error: new Error('federation_terminal_state_rejection'),
      context: { projectId: 'project-a', peerRoot: 'b'.repeat(64), rejected: [] },
    });
    const restarted = createIncidentSupervisor({ incidentLedger: createRuntimeIncidentLedger({ decisionOsRoot: root, file: resolve(root, 'incidents.json') }) });
    assert.equal(restarted.pausedFederationRepairs.has('project-a'), true);
    assert.equal(restarted.pausedTaskProjects.has('project-a'), false);
    assert.equal(new Set(restarted.protectedScopes()).has('federation-repair:project-a'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('explicit federation recovery resolves its durable incident only after equal-root validation', async () => {
  const project = { id: 'project-a', decisionOsRoot: '/tmp/project-a/.decision-os', root: '/tmp/project-a', name: 'Project A' };
  const rejection = { key: 'card\u0000collision', stateHash: 'a'.repeat(64), code: 'task_current_dot_collision' };
  const pausedIncident = { operation: 'handle-terminal-state-rejection', context: { rejected: [rejection] } };
  const calls: string[] = [];
  let validated = false;
  const replicator = {
    validateProjectRepairResume: () => validated,
    resolveProjectCollisionLocalWins: async () => { calls.push('successor'); return true; },
    resumeProjectRepair: () => { calls.push('resume'); return validated; },
    reconcileProject: () => { calls.push('reconcile'); },
  };
  const states = new Map<string, unknown>();
  const service = createRuntimeRecoveryService({
    codexCoordinator: { schedule: async () => undefined } as any,
    contentObjectRoots: [],
    contentScheduler: () => null,
    federatedLibrary: {} as any,
    federation: {} as any,
    federatedTaskRuntime: { executionStates: new Map(), projectStates: new Map(), taskStores: new Map() } as any,
    incidentLedger: {
      active: () => [],
      resolveScope: () => { calls.push('resolve'); return [{ id: 'incident-a' }]; },
    } as any,
    incidentSupervisor: {
      pausedTaskProjects: new Map(),
      pausedFederatedTaskProjects: new Map(),
      pausedFederationRepairs: new Map([['project-a', pausedIncident]]),
      pausedProjectWatchers: new Set(),
      pausedProjectRuntimes: new Set(),
      recordIncident: () => { throw new Error('unexpected_recovery_incident'); },
    } as any,
    initializePipelineCatalog: () => undefined,
    invalidateProject: () => undefined,
    localNodeId: () => 'node-a',
    localTaskRuntime: {
      states,
      openStateForProject: () => ({ runtime: {} }),
    } as any,
    migrationAdmissionFile: '/tmp/migration.json',
    migrateProjectPipelines: () => undefined,
    projectById: () => project as any,
    projectRuntimeRegistry: {
      contexts: new Map(),
      dispose: () => undefined,
      tryContext: () => ({ runtime: {} }),
    } as any,
    projectSyncRuntime: {} as any,
    replicator: () => replicator as any,
  });

  const blocked = await service.resume('federation-repair:project-a', 'Too early.');
  assert.deepEqual(blocked, { ok: false, scope: 'federation-repair:project-a', resolvedIncidentIds: [] });
  assert.deepEqual(calls, []);
  const admitted = await service.resume('federation-repair:project-a', 'reconcile-local-authority');
  assert.deepEqual(admitted, { ok: false, scope: 'federation-repair:project-a', resolvedIncidentIds: [] });
  assert.deepEqual(calls, ['successor']);
  validated = true;
  const result = await service.resume('federation-repair:project-a', 'reconcile-local-authority');

  assert.deepEqual(result, { ok: true, scope: 'federation-repair:project-a', resolvedIncidentIds: ['incident-a'] });
  assert.deepEqual(calls, ['successor', 'resolve', 'resume']);
});
