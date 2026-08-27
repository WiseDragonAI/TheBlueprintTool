/**
 * WHAT: Covers cancellation through replicated execution identity and registered process ownership.
 * WHY: Cancellation must not depend on retired node-local queue records or mutable card leases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cancelCardSkillRunController } from '@backend/business/codex/controller/cancel-card-skill-run-controller.js';
import { cancelCodexPipelineRunController } from '@backend/business/codex/controller/cancel-codex-pipeline-run-controller.js';
import { registerTaskExecutionProcess } from '@backend/business/codex/helper/task-execution-runtime.js';
import { writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { reassessPipelineAfterSkill } from '@backend/business/codex/helper/codex-pipeline-runner.js';
import { createTaskCurrentStateStore } from '@backend/business/task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '@backend/business/task-state/helper/task-execution-repository.js';
import type { TaskExecutionMetadata } from '@backend/business/task-state/helper/task-current-state-types.js';

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-canonical-cancel-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const store = createTaskCurrentStateStore({
    decisionOsRoot,
    projectId: 'project-a',
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  const executions = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    taskExecutionNodeId: 'workstation',
    taskExecutionState: { executions },
  };
  return { workspace, decisionOsRoot, store, executions, runtime };
}

function metadata(input: {
  executionId: string;
  runId: string;
  cardId: string;
  pipelineRunId?: string | null;
}): TaskExecutionMetadata {
  return {
    executionId: input.executionId,
    requestId: `request-${input.executionId}`,
    sessionId: input.runId,
    projectId: 'project-a',
    ledgerId: 'specs',
    taskId: input.cardId,
    sourceCardId: input.cardId,
    ownerCardId: input.cardId,
    kind: input.pipelineRunId ? 'pipeline-skill' : 'thread',
    requestedAt: '2026-07-23T10:00:00.000Z',
    model: null,
    effort: null,
    pipelineRunId: input.pipelineRunId ?? null,
    pipelineStepId: input.pipelineRunId ? 'step-a' : null,
    pipelineSkillRunId: input.pipelineRunId ? input.runId : null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

test('cancels a live run through its replicated execution and registered child process', async () => {
  const context = fixture();
  const runId = 'codex-skill-persisted-live';
  const executionId = 'execution-persisted-live';
  const cardId = 'card-a';
  const stdoutFile = join(context.decisionOsRoot, 'run.jsonl');
  const stderrFile = join(context.decisionOsRoot, 'run.log');
  writeFileSync(stdoutFile, '');
  writeFileSync(stderrFile, '');
  await context.executions.admit({ metadata: metadata({ executionId, runId, cardId }), executorNodeId: 'workstation' });
  await context.executions.transition(executionId, { phase: 'queued' });
  await context.executions.transition(executionId, { phase: 'starting' });
  await context.executions.transition(executionId, { phase: 'running' });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  const closed = once(child, 'close');
  registerTaskExecutionProcess(context.runtime, {
    executionId,
    sessionId: runId,
    child,
    processId: child.pid ?? 0,
    processStartTime: '',
    startedAt: '2026-07-23T10:00:01.000Z',
    stdoutFile,
    stderrFile,
  });

  try {
    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId, runId, executionId },
      runtime_state: context.runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    assert.equal(result.cancellationRequested, true);
    assert.equal(context.executions.find(executionId)?.lifecycle.phase, 'cancelling');
    await closed;
  } finally {
    if (child.exitCode === null) {
      try {
        (child as ChildProcess).kill('SIGKILL');
      } catch {
        // Expected cancellation may already have settled the child.
      }
    }
    await context.store.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('rejects mismatched canonical ownership before cancelling queued work', async () => {
  const context = fixture();
  const runId = 'codex-skill-shared-session';
  const executionId = 'execution-old';
  await context.executions.admit({
    metadata: metadata({ executionId, runId, cardId: 'card-b' }),
    executorNodeId: 'workstation',
  });
  await context.executions.transition(executionId, { phase: 'queued' });
  try {
    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId: 'card-a', runId, executionId },
      runtime_state: context.runtime,
    });
    assert.equal(result.error, 'Card execution is no longer active.');
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 409);
    assert.equal(context.executions.find(executionId)?.lifecycle.phase, 'queued');
  } finally {
    await context.store.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('reassesses replicated pipeline state without hydrating unrelated ledger card files', async () => {
  const context = fixture();
  const now = '2026-07-23T10:00:00.000Z';
  const pipelineRunId = 'pipeline-reassessment';
  const executionId = 'pipeline-reassessment-execution';
  const skillRunId = 'pipeline-reassessment-skill';
  mkdirSync(join(context.decisionOsRoot, 'cards', 'specs', 'unrelated.md'), { recursive: true });
  writeFileSync(join(context.decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(join(context.decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{ id: 'unrelated', comment: { contentFile: '.decision-os/cards/specs/unrelated.md' } }],
    annotations: [], relationships: [],
  }));
  writeCodexPipelineStore({
    decisionOsRoot: context.decisionOsRoot,
    store: {
      version: 1,
      pipelines: [], steps: [], skillLibrary: [], activeWorkspaceRun: pipelineRunId,
      runs: [{
        id: pipelineRunId, pipelineId: 'pipeline-a', pipelineName: 'Pipeline A', temporary: false,
        executionMode: 'local', ledgerId: 'specs', sourceCardId: 'source', sourceCardTitle: 'Source',
        status: 'pending', createdAt: now, updatedAt: now, startedAt: null, finishedAt: null, resumedAt: null, error: '',
        steps: [{
          id: 'pipeline-reassessment-step', stepId: 'step-a', name: 'Step A', purpose: '', outputCardId: 'output',
          status: 'pending', startedAt: null, finishedAt: null, error: '',
          skills: [{
            id: 'pipeline-reassessment-run-skill', pipelineSkillId: 'skill-a', skillName: 'analysis',
            runId: skillRunId, executionId, status: 'pending', codexModel: 'gpt-5.6-sol', codexEffort: 'medium',
            stdoutFile: '', stderrFile: '', startedAt: null, finishedAt: null, error: '',
          }],
        }],
      }],
    },
  });
  await context.executions.admit({
    metadata: metadata({ executionId, runId: skillRunId, cardId: 'source', pipelineRunId }),
    executorNodeId: 'workstation',
  });
  await context.executions.transition(executionId, { phase: 'queued' });
  try {
    const run = reassessPipelineAfterSkill({
      decisionOsRoot: context.decisionOsRoot,
      runtime: context.runtime,
      pipelineRunId,
    });
    assert.equal(run?.id, pipelineRunId);
    assert.equal(run?.status, 'pending');
  } finally {
    await context.store.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('cancels a queued pipeline skill through exact replicated execution ownership', async () => {
  const context = fixture();
  const runId = 'pipeline-skill-run';
  const executionId = 'pipeline-execution';
  const staleExecutionId = 'pipeline-execution-old';
  writeCodexPipelineStore({
    decisionOsRoot: context.decisionOsRoot,
    store: {
      version: 1,
      pipelines: [],
      steps: [],
      skillLibrary: [],
      activeWorkspaceRun: 'pipeline-run',
      runs: [{
        id: 'pipeline-run', pipelineId: 'pipeline-a', pipelineName: 'Pipeline A', temporary: false, executionMode: 'local',
        ledgerId: 'specs', sourceCardId: 'source', sourceCardTitle: 'Source', status: 'pending', createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z', startedAt: null, finishedAt: null, resumedAt: null, error: '',
        steps: [{
          id: 'run-step', stepId: 'step-a', name: 'Step A', purpose: '', outputCardId: 'output', status: 'pending', startedAt: null, finishedAt: null, error: '',
          skills: [{
            id: 'run-skill', pipelineSkillId: 'skill-a', skillName: 'analysis', runId, executionId, status: 'pending',
            codexModel: 'gpt-5.6-sol', codexEffort: 'medium', stdoutFile: '', stderrFile: '', startedAt: null, finishedAt: null, error: '',
          }],
        }],
      }],
    },
  });
  await context.executions.admit({
    metadata: metadata({ executionId, runId, cardId: 'source', pipelineRunId: 'pipeline-run' }),
    executorNodeId: 'workstation',
  });
  await context.executions.transition(executionId, { phase: 'queued' });
  await context.executions.admit({
    metadata: metadata({ executionId: staleExecutionId, runId: 'stale-skill', cardId: 'source', pipelineRunId: 'other-pipeline' }),
    executorNodeId: 'workstation',
  });
  await context.executions.transition(staleExecutionId, { phase: 'queued' });

  try {
    const stale = await cancelCodexPipelineRunController({
      action_payload: { runId: 'pipeline-run', executionId: staleExecutionId },
      runtime_state: context.runtime,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.statusCode, 409);
    assert.equal(context.executions.find(executionId)?.lifecycle.phase, 'queued');

    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId: 'source', runId, executionId },
      runtime_state: context.runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    assert.equal(context.executions.find(executionId)?.lifecycle.phase, 'cancelled');
  } finally {
    await context.store.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});
