import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { CodexProcessQueueItem } from '@backend/business/codex/helper/codex-process-queue.js';
import { migrateLegacyCodexExecutions, prepareLegacyCodexExecutions } from '@backend/business/codex/helper/migrate-legacy-codex-executions.js';

const queueItem = (status: CodexProcessQueueItem['status'] = 'running'): CodexProcessQueueItem => ({
  id: 'run-direct',
  kind: 'thread',
  status,
  createdAt: '2026-07-23T01:00:00.000Z',
  startedAt: status === 'pending' ? null : '2026-07-23T01:00:01.000Z',
  interruptedAt: status === 'interrupted' ? '2026-07-23T01:00:02.000Z' : null,
  interruptionReason: status === 'interrupted' ? 'restart' : '',
  processId: status === 'running' ? 42 : 0,
  processStartTime: status === 'running' ? '100' : '',
  stdoutFile: '/tmp/direct.jsonl',
  stderrFile: '/tmp/direct.log',
  payload: { ledgerId: 'tasks', cardId: 'card-direct', runId: 'run-direct', executionId: 'execution-direct' },
});

const pipelineRun = (): CodexPipelineRun => ({
  id: 'pipeline-a', pipelineId: 'definition-a', pipelineName: 'Pipeline A', temporary: false, executionMode: 'local',
  ledgerId: 'tasks', sourceCardId: 'source-a', sourceCardTitle: 'Source A', status: 'running',
  createdAt: '2026-07-23T01:00:00.500Z', updatedAt: '2026-07-23T01:00:01.500Z', startedAt: '2026-07-23T01:00:01.500Z', finishedAt: null, resumedAt: null, error: '',
  steps: [{
    id: 'pipeline-a-step-1', stepId: 'definition-step-a', name: 'Step A', purpose: '', outputCardId: 'card-pipeline', status: 'running', startedAt: '2026-07-23T01:00:01.500Z', finishedAt: null, error: '',
    skills: [{
      id: 'pipeline-a-step-1-skill-1', pipelineSkillId: 'definition-skill-a', skillName: 'task-list', runId: 'run-pipeline', executionId: 'execution-pipeline', status: 'running', codexModel: '', codexEffort: '',
      stdoutFile: '/tmp/pipeline.jsonl', stderrFile: '/tmp/pipeline.log', processId: 43, processStartTime: '101', startedAt: '2026-07-23T01:00:01.500Z', finishedAt: null, error: '',
    }],
  }],
});

test('converts direct and pipeline attempts with exact identities and FIFO order', () => {
  const leases = new Map([
    ['card-direct', { runId: 'run-direct', executionId: 'execution-direct' }],
    ['card-pipeline', { runId: 'run-pipeline', executionId: 'execution-pipeline' }],
  ]);
  const migrated = prepareLegacyCodexExecutions({
    projectId: 'project-a', nodeId: 'workstation', queue: [queueItem()], pipelineRuns: [pipelineRun()],
    readLease: ({ cardId }) => leases.get(cardId) ?? null,
  });
  assert.deepEqual(migrated.records.map((record) => record.executionId), ['execution-direct', 'execution-pipeline']);
  assert.equal(migrated.records[0].phase, 'running');
  assert.equal(migrated.records[0].processStartTime, '100');
  assert.equal(migrated.records[1].pipelineRunId, 'pipeline-a');
  assert.equal(migrated.records[1].pipelineSkillRunId, 'run-pipeline');
});

test('rejects an active attempt whose card lease does not match exactly', () => {
  assert.throws(() => prepareLegacyCodexExecutions({
    projectId: 'project-a', nodeId: 'workstation', queue: [queueItem()], pipelineRuns: [], readLease: () => null,
  }), /lease_mismatch/);
});

test('migrates only the next pending pipeline skill and leaves future topology inactive', () => {
  const original = pipelineRun();
  const firstStep = original.steps[0];
  const firstSkill = firstStep.skills[0];
  const run: CodexPipelineRun = {
    ...original,
    steps: [{
      ...firstStep,
      status: 'pending',
      startedAt: null,
      skills: [{ ...firstSkill, status: 'pending', startedAt: null }, {
        ...firstSkill,
        id: 'pipeline-a-step-1-skill-2',
        pipelineSkillId: 'definition-skill-b',
        skillName: 'task-dependency',
        runId: 'run-pipeline-future',
        executionId: 'execution-pipeline-future',
        status: 'pending',
        startedAt: null,
      }],
    }],
  };
  const migrated = prepareLegacyCodexExecutions({
    projectId: 'project-a', nodeId: 'workstation', queue: [], pipelineRuns: [run], readLease: () => null,
  });
  assert.deepEqual(migrated.records.map((record) => record.executionId), ['execution-pipeline']);
  assert.equal(migrated.records[0].phase, 'queued');
});

test('writes the canonical store only after retaining rollback sources and a migration report', () => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'codex-migration-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const backupRoot = resolve(workspace, 'rollback');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'codex-process-queue.json'), JSON.stringify({ version: 1, items: [queueItem('pending')] }));
  writeFileSync(resolve(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({ version: 1, pipelines: [], steps: [], runs: [], skillLibrary: [], activeWorkspaceRun: null }));
  const result = migrateLegacyCodexExecutions({
    decisionOsRoot, projectId: 'project-a', nodeId: 'workstation', backupRoot, migratedAt: '2026-07-23T01:00:00.000Z',
    readLease: () => ({ runId: 'run-direct', executionId: 'execution-direct' }),
  });
  assert.equal(result.applied, true);
  assert.equal(existsSync(resolve(backupRoot, 'codex-process-queue.json')), true);
  assert.equal(existsSync(resolve(backupRoot, 'migration-report.json')), true);
  assert.equal(JSON.parse(readFileSync(resolve(decisionOsRoot, 'codex-executions.json'), 'utf8')).executions[0].phase, 'queued');
  assert.deepEqual(migrateLegacyCodexExecutions({ decisionOsRoot, projectId: 'project-a', nodeId: 'workstation', readLease: () => null }), { applied: false, report: null });
});
