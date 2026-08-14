/**
 * WHAT: Verifies startup classification of retained federation repair timeouts.
 * WHY: Relay delay must remain diagnostic history without pausing valid local task state.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createRuntimeIncidentLedger } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import { createIncidentSupervisor } from '../../../../src/business/server/runtime/incident-supervisor.js';

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-incident-supervisor-'));
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: root });
  return { root, incidentLedger };
}

test('startup converts a retained no-progress project incident into non-pausing history', (context) => {
  const { root, incidentLedger } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const scope = 'project-task-state:project-a';
  incidentLedger.record({
    scope,
    component: 'federation-task-state-replicator',
    operation: 'synchronize-federated-state',
    code: 'federation_state_no_progress',
    error: new Error('Federated state made no durable progress for project-a.'),
    context: { projectId: 'project-a', from: 'relay', attemptId: `${'a'.repeat(64)}:${'b'.repeat(64)}` },
  });

  const supervisor = createIncidentSupervisor({ incidentLedger });

  assert.equal(supervisor.pausedTaskProjects.has('project-a'), false);
  assert.equal(incidentLedger.active(scope).length, 0);
  const retained = incidentLedger.snapshot().incidents.find((incident) => incident.code === 'federation_state_no_progress');
  assert.equal(retained?.status, 'resolved');
});

test('startup preserves an independent task-state failure sharing the legacy timeout scope', (context) => {
  const { root, incidentLedger } = fixture();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const scope = 'project-task-state:project-a';
  incidentLedger.record({
    scope,
    component: 'federation-task-state-replicator',
    operation: 'synchronize-federated-state',
    code: 'federation_state_no_progress',
    error: new Error('Federated state made no durable progress for project-a.'),
    context: { projectId: 'project-a' },
  });
  const durableFailure = incidentLedger.record({
    scope,
    component: 'task-current-state-store',
    operation: 'load-current-state',
    code: 'invalid_task_current_state_shard',
    error: new Error('invalid_task_current_state_shard'),
    context: { projectId: 'project-a' },
  });

  const supervisor = createIncidentSupervisor({ incidentLedger });

  assert.equal(supervisor.pausedTaskProjects.get('project-a')?.id, durableFailure.id);
  assert.equal(incidentLedger.active(scope).length, 2);
});
