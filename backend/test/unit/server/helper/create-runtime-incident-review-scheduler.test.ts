import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntimeIncidentReviewScheduler } from '../../../../src/business/server/helper/create-runtime-incident-review-scheduler.js';
import type { DecisionOsProject } from '../../../../src/business/server/helper/project-catalog.js';
import { createRuntimeIncidentLedger } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import type { ProjectTaskState } from '../../../../src/business/task-state/helper/project-task-state.js';

function project(root: string): DecisionOsProject {
  return {
    id: 'admin',
    name: 'admin',
    relativePath: 'admin',
    root,
    decisionOsRoot: join(root, '.decision-os'),
    description: '',
    color: '#d94f70',
    available: true,
    diagnostic: '',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  };
}

test('contains task-state lookup failures inside the periodic incident review boundary', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-review-scheduler-'));
  try {
    const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: join(root, '.decision-os') });
    incidentLedger.record({
      scope: 'test-scope',
      component: 'test-component',
      operation: 'test-operation',
      error: new Error('seed failure'),
    });
    let failure = '';
    const scheduler = createRuntimeIncidentReviewScheduler({
      incidentLedger,
      intervalMs: 60_000,
      assignedNodeId: () => 'workstation',
      targetProject: () => project(root),
      taskState: () => { throw new Error('injected task-state lookup failure'); },
      paused: () => false,
      onChanged: () => assert.fail('A failed task-state lookup cannot change the projection.'),
      onBootstrapGate: () => assert.fail('The injected error is not a bootstrap gate.'),
      onFailure: (error) => { failure = error instanceof Error ? error.message : String(error); },
    });
    try {
      await scheduler.run();
      assert.equal(failure, 'injected task-state lookup failure');
    } finally {
      scheduler.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('does not start periodic incident review before project bootstrap admits it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-review-admission-'));
  try {
    const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: join(root, '.decision-os') });
    incidentLedger.record({
      scope: 'test-scope',
      component: 'test-component',
      operation: 'test-operation',
      error: new Error('seed failure'),
    });
    let attempts = 0;
    const scheduler = createRuntimeIncidentReviewScheduler({
      incidentLedger,
      intervalMs: 10,
      assignedNodeId: () => 'workstation',
      targetProject: () => project(root),
      taskState: () => {
        attempts += 1;
        throw new Error('injected task-state lookup failure');
      },
      paused: () => false,
      onChanged: () => assert.fail('A failed task-state lookup cannot change the projection.'),
      onBootstrapGate: () => assert.fail('The injected error is not a bootstrap gate.'),
      onFailure: () => undefined,
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(attempts, 0);
      scheduler.start();
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(attempts > 0, true);
    } finally {
      scheduler.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('records one transient bootstrap rejection while continuing to retry the same snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-review-bootstrap-'));
  try {
    const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: join(root, '.decision-os') });
    incidentLedger.record({
      scope: 'test-scope',
      component: 'test-component',
      operation: 'test-operation',
      error: new Error('seed failure'),
    });
    let attempts = 0;
    let recordedGates = 0;
    const scheduler = createRuntimeIncidentReviewScheduler({
      incidentLedger,
      intervalMs: 60_000,
      assignedNodeId: () => 'workstation',
      targetProject: () => project(root),
      taskState: () => {
        attempts += 1;
        throw new Error('task_state_bootstrap_incomplete');
      },
      paused: () => false,
      onChanged: () => assert.fail('A bootstrap rejection cannot change the projection.'),
      onBootstrapGate: () => { recordedGates += 1; },
      onFailure: () => assert.fail('A bootstrap rejection is not a permanent scheduler failure.'),
    });
    try {
      await scheduler.run();
      await scheduler.run();
      assert.equal(attempts, 2);
      assert.equal(recordedGates, 1);
    } finally {
      scheduler.stop();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
