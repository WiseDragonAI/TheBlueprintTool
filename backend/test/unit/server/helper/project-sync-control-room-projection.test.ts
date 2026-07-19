import test from 'node:test';
import assert from 'node:assert/strict';
import { withProjectSyncRuns } from '../../../../src/business/server/helper/control-room-projection-store.js';
import type { ProjectSyncRun } from '../../../../src/business/project-sync/helper/project-sync-types.js';

function run(patch: Partial<ProjectSyncRun> = {}): ProjectSyncRun {
  return {
    syncId: 'sync-1',
    idempotencyKey: 'stable-key',
    initiatorNodeId: 'node-a',
    sourceNodeId: 'node-b',
    initiatorProjectId: '',
    sourceProjectId: 'project-b',
    sourceProjectName: 'Project B',
    sourceProjectColor: '#d94f70',
    originFingerprint: 'f'.repeat(64),
    taskProjectId: '',
    ledgerId: '',
    masterCardId: '',
    pipelineRunId: '',
    preparationPhase: 'materializing',
    phase: 'requested',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:01.000Z',
    evidence: {},
    error: null,
    ...patch,
  };
}

function projection(tasks: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return { fingerprint: 'base', queue: [], exec: [], backlog: [], done: [], allTasks: tasks, ledgers: [], projects: [] };
}

test('projects one color-correct provisional synchronization task before card attachment', () => {
  const result = withProjectSyncRuns(projection(), [run()]) as Record<string, any>;
  assert.equal(result.exec.length, 1);
  assert.equal(result.exec[0].cardId, 'project-sync-sync-1');
  assert.equal(result.exec[0].projectColor, '#d94f70');
  assert.equal(result.exec[0].projectSyncCanonical, false);
  assert.equal(result.exec[0].projectSyncPreparationPhase, 'materializing');
});

test('reconciles an attached run onto its canonical task without duplication', () => {
  const canonical = {
    cardId: 'card-sync-1', ledgerId: 'tasks', projectId: 'project-a', projectName: 'Project A',
    projectColor: '#000000', title: 'Synchronize Project B', status: 'task-waiting', diagnostics: [],
  };
  const result = withProjectSyncRuns(projection([canonical]), [run({
    taskProjectId: 'project-a', ledgerId: 'tasks', masterCardId: 'card-sync-1', pipelineRunId: 'pipeline-1',
    preparationPhase: 'attached', phase: 'source_publish',
  })]) as Record<string, any>;
  assert.equal(result.allTasks.length, 1);
  assert.equal(result.exec.length, 1);
  assert.equal(result.exec[0].cardId, 'card-sync-1');
  assert.equal(result.exec[0].projectColor, '#d94f70');
  assert.equal(result.exec[0].projectSyncCanonical, true);
});

test('keeps a failed run visible with its retry identity and diagnostic', () => {
  const result = withProjectSyncRuns(projection(), [run({
    phase: 'failed',
    error: { phase: 'requested', message: 'Clone failed.' },
  })]) as Record<string, any>;
  assert.equal(result.exec[0].projectSyncFailed, true);
  assert.equal(result.exec[0].projectSyncId, 'sync-1');
  assert.deepEqual(result.exec[0].diagnostics, ['Clone failed.']);
});
