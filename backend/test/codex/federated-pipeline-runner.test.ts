import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeFederatedPipelineSkill } from '../../src/business/codex/helper/codex-pipeline-runner.js';
import { scheduleCodexProcesses } from '../../src/business/codex/helper/codex-process-scheduler.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '../../src/business/codex/helper/codex-pipeline-store.js';
import { createProjectTaskState } from '../../src/business/task-state/helper/project-task-state.js';
import type { CodexPipelineRun } from '../../../shared/schemas/codex-pipeline-types.js';

test('dispatches ordered federated skills through durable per-step executors', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federated-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardsRoot = join(decisionOsRoot, 'cards', 'specs');
  const logsRoot = join(decisionOsRoot, 'runs');
  try {
    mkdirSync(cardsRoot, { recursive: true });
    mkdirSync(logsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] }));
    const outputCards = ['step-1-card', 'step-2-card', 'step-3-card'];
    for (const cardId of outputCards) writeFileSync(join(cardsRoot, `${cardId}.md`), '\n');
    writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
      cards: [
        { id: 'master', title: 'Synchronize' },
        ...outputCards.map((id) => ({ id, title: id, comment: { contentFile: `.decision-os/cards/specs/${id}.md` } })),
      ],
      annotations: [],
      relationships: [],
    }));
    const roles = ['source-publisher', 'initiator-reconciler', 'source-finalizer'];
    const run: CodexPipelineRun = {
      id: 'pipeline-run', pipelineId: 'project-synchronization', pipelineName: 'Project synchronization', temporary: false,
      executionMode: 'federated', ledgerId: 'specs', sourceCardId: 'master', sourceCardTitle: 'Synchronize', status: 'pending',
      createdAt: '2026-07-17T00:00:00.000Z', updatedAt: '2026-07-17T00:00:00.000Z', startedAt: null, finishedAt: null, resumedAt: null, error: '',
      steps: roles.map((role, index) => ({
        id: `run-step-${index + 1}`, stepId: `step-${index + 1}`, name: role, purpose: role,
        outputCardId: outputCards[index], status: 'pending', startedAt: null, finishedAt: null, error: '',
        skills: [{
          id: `skill-${index + 1}`, pipelineSkillId: `pipeline-skill-${index + 1}`, skillName: `project-sync-${role}`,
          runId: `skill-run-${index + 1}`, executionId: `execution-${index + 1}`, status: 'pending', codexModel: 'gpt-5.6-sol', codexEffort: 'medium',
          stdoutFile: join(logsRoot, `skill-${index + 1}.jsonl`), stderrFile: join(logsRoot, `skill-${index + 1}.log`),
          startedAt: null, finishedAt: null, error: '',
          executor: {
            kind: 'federated',
            nodeId: index === 1 ? 'initiator-node' : 'source-node',
            projectId: index === 1 ? 'initiator-project' : 'source-project',
            role,
          },
        }],
      })),
    };
    writeCodexPipelineStore({
      decisionOsRoot,
      store: { version: 1, pipelines: [], steps: [], runs: [run], skillLibrary: [], activeWorkspaceRun: 'pipeline-run' },
    });
    const state = createProjectTaskState({
      projectId: 'initiator-project',
      writerId: 'source-node',
      decisionOsRoot,
      tasksLedgerFile: join(decisionOsRoot, 'specs.json'),
      initialize: true,
    });
    for (const [index, role] of roles.entries()) {
      const executionId = `execution-${index + 1}`;
      await state.executions.admit({
        metadata: {
          executionId,
          requestId: `request-${executionId}`,
          sessionId: `skill-run-${index + 1}`,
          projectId: 'initiator-project',
          ledgerId: 'specs',
          taskId: 'master',
          sourceCardId: 'master',
          ownerCardId: outputCards[index],
          kind: 'pipeline-skill',
          requestedAt: `2026-07-17T00:00:0${index}.000Z`,
          model: 'gpt-5.6-sol',
          effort: 'medium',
          pipelineRunId: run.id,
          pipelineStepId: `run-step-${index + 1}`,
          pipelineSkillRunId: `skill-run-${index + 1}`,
          predecessorExecutionId: index === 0 ? null : `execution-${index}`,
          restartOfExecutionId: null,
        },
        executorNodeId: index === 1 ? 'initiator-node' : 'source-node',
      });
      await state.executions.transition(executionId, { phase: 'queued' });
    }
    const runtime: Record<string, unknown> = {
      projectId: 'initiator-project',
      decisionOsRoot,
      taskExecutionState: state,
      decisionOsSettings: { maxConcurrentCodexProcesses: 1 },
    };
    runtime.scheduleCodexProcesses = () => scheduleCodexProcesses({ decisionOsRoot, runtime });
    const dispatched: string[] = [];
    for (const [index, role] of roles.entries()) {
      const nodeId = index === 1 ? 'initiator-node' : 'source-node';
      runtime.taskExecutionNodeId = nodeId;
      await executeFederatedPipelineSkill({
        decisionOsRoot,
        runtime,
        pipelineRunId: run.id,
        executor: { kind: 'federated', nodeId, projectId: index === 1 ? 'initiator-project' : 'source-project', role },
        execute: async (skill) => {
          dispatched.push(`${skill.executor?.nodeId}:${skill.executor?.role}`);
          return { executorNodeId: skill.executor?.nodeId, status: 'complete', headSha: `sha-${index}`, originSha: `sha-${index}` };
        },
      });
    }
    assert.deepEqual(dispatched, [
      'source-node:source-publisher',
      'initiator-node:initiator-reconciler',
      'source-node:source-finalizer',
    ]);
    const persisted = readCodexPipelineStore({ decisionOsRoot }).store.runs[0];
    assert.equal(persisted.status, 'pending');
    assert.deepEqual(persisted.steps.map((step) => step.skills[0].executor?.nodeId), ['source-node', 'initiator-node', 'source-node']);
    assert.equal(JSON.parse(readFileSync(join(decisionOsRoot, 'specs.json'), 'utf8')).cards[0].executionStatus, undefined);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
