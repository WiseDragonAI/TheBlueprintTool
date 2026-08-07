import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DecisionOsProject } from '../../../../src/business/server/helper/project-catalog.js';
import type { RuntimeIncident } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import {
  runtimeIncidentReviewCardId,
  runtimeIncidentReviewZoneId,
  synchronizeRuntimeIncidentReviewTask,
} from '../../../../src/business/server/helper/synchronize-runtime-incident-review-task.js';
import { createProjectTaskState, type ProjectTaskState } from '../../../../src/business/task-state/helper/project-task-state.js';

function incident(patch: Partial<RuntimeIncident> = {}): RuntimeIncident {
  return {
    id: 'incident-a',
    fingerprint: 'f'.repeat(64),
    status: 'paused',
    severity: 'error',
    scope: 'http-request:POST:/api/voice-upload',
    component: 'http-server',
    operation: 'handle-request',
    code: 'task_state_bootstrap_incomplete',
    message: 'task_state_bootstrap_incomplete',
    stack: 'Error: task_state_bootstrap_incomplete\n    at assertWritable (project-task-state.ts:63:48)',
    context: {},
    firstObservedAt: '2026-07-22T11:53:44.879Z',
    lastObservedAt: '2026-07-22T11:53:44.879Z',
    occurrences: 1,
    resolvedAt: '',
    ...patch,
  };
}

test('creates and refreshes one deterministic recurring runtime incident master task', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-task-'));
  const decisionOsRoot = join(root, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'tasks.json');
  let taskState: ProjectTaskState | null = null;
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {}, threadFiles: {} }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    const project: DecisionOsProject = {
      id: 'admin',
      name: 'admin',
      relativePath: 'admin',
      root,
      decisionOsRoot,
      description: '',
      color: '#d94f70',
      available: true,
      diagnostic: '',
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    };
    taskState = createProjectTaskState({
      projectId: project.id,
      writerId: 'workstation',
      decisionOsRoot,
      tasksLedgerFile: ledgerPath,
      initialize: true,
    });
    const firstSnapshot = {
      project,
      taskState,
      assignedNodeId: 'workstation',
      updatedAt: '2026-07-22T11:53:44.879Z',
      incidents: [incident()],
      incidentLedgerFile: join(root, '.decision-os', 'runtime-incidents.json'),
      materializeResources: async () => {},
    };

    assert.equal((await synchronizeRuntimeIncidentReviewTask(firstSnapshot)).changed, true);
    assert.equal((await synchronizeRuntimeIncidentReviewTask(firstSnapshot)).changed, false);
    const firstProjection = taskState.projection().ledger as { cards: Array<Record<string, any>>; annotations: Array<Record<string, any>> };
    assert.equal(firstProjection.cards.length, 1);
    assert.equal(firstProjection.cards[0].id, runtimeIncidentReviewCardId);
    assert.equal(firstProjection.cards[0].status, 'todo');
    assert.deepEqual(firstProjection.cards[0].labels, ['master-task', 'operations', 'recurring', 'runtime-incidents']);
    assert.equal(firstProjection.annotations[0].id, runtimeIncidentReviewZoneId);
    const contentFile = join(decisionOsRoot, 'cards', 'tasks', `${runtimeIncidentReviewCardId}.md`);
    const threadFile = join(decisionOsRoot, 'threads', 'tasks', `thread-${runtimeIncidentReviewCardId}.md`);
    assert.equal(existsSync(contentFile), true);
    assert.equal(existsSync(join(decisionOsRoot, 'task-state', project.id, 'local', 'held', `${runtimeIncidentReviewCardId}.json`)), false);
    const firstBody = readFileSync(contentFile, 'utf8');
    assert.match(firstBody, /incident-a/);
    assert.match(firstBody, /assertWritable \(project-task-state\.ts:63:48\)/);
    assert.match(firstBody, /Central log/);
    assert.match(readFileSync(threadFile, 'utf8'), /Recurring runtime incident review task created automatically/);

    const resolved = incident({
      status: 'resolved',
      lastObservedAt: '2026-07-22T12:00:00.000Z',
      resolvedAt: '2026-07-22T12:00:00.000Z',
    });
    assert.equal((await synchronizeRuntimeIncidentReviewTask({
      ...firstSnapshot,
      updatedAt: resolved.resolvedAt,
      incidents: [resolved],
    })).changed, true);
    const updatedProjection = taskState.projection().ledger as { cards: Array<Record<string, any>>; annotations: Array<Record<string, any>> };
    assert.equal(updatedProjection.cards.length, 1);
    assert.equal(updatedProjection.annotations.length, 1);
    assert.equal(updatedProjection.cards[0].createdAt, firstProjection.cards[0].createdAt);
    assert.equal(updatedProjection.cards[0].status, 'todo');
    assert.match(readFileSync(contentFile, 'utf8'), /`0` active; `1` resolved/);
  } finally {
    await taskState?.flush();
    rmSync(root, { recursive: true, force: true });
  }
});
