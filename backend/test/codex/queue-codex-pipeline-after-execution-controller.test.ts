import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { taskExecutionNodeId, taskExecutionState } from '@backend/business/codex/helper/task-execution-runtime.js';

async function closeServer(server: Server): Promise<void> {
  // WHAT: Skip close settlement when fixture startup never reached listening state.
  // WHY: Node does not emit another close event for an already closed server.
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

function createWorkspace(): { workspace: string; decisionOsRoot: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-queue-thread-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'pipeline-prompts'), { recursive: true });
  mkdirSync(join(workspace, '.skills', 'worker'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: 'queue-thread-pipeline-project' }));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: 'source-card',
      title: 'Source card',
      x: 20,
      y: 40,
      w: 320,
      h: 180,
      comment: { what: 'Source body' },
      facts: [],
      fields: [],
    }],
    annotations: [],
    relationships: [],
    notes: {},
  }));
  writeFileSync(join(decisionOsRoot, 'pipeline-prompts', 'SYSTEM_PROMPT.md'), 'platform: <PLATFORM>');
  writeFileSync(join(decisionOsRoot, 'pipeline-prompts', 'SKILL.md'), '$<SKILL_NAME>\nWrite the final result to this Markdown file: <OUTPUT_MARKDOWN_FILE>');
  writeFileSync(join(workspace, '.skills', 'worker', 'SKILL.md'), '---\nname: worker\ndescription: Test worker\n---\n');
  const now = '2026-08-14T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['worker'],
    store: {
      version: 2,
      pipelines: [
        { id: 'pipeline-a', name: 'Pipeline A', purpose: '', stepIds: ['step-a'], createdAt: now, updatedAt: now },
        { id: 'pipeline-b', name: 'Pipeline B', purpose: '', stepIds: ['step-b'], createdAt: now, updatedAt: now },
      ],
      steps: [
        {
          id: 'step-a', name: 'Step A', purpose: '', createdAt: now, updatedAt: now,
          skills: [
            { id: 'skill-a', skillName: 'worker', contentKind: 'federated-skill', codexModel: 'gpt-5.5', codexEffort: 'high' },
            { id: 'skill-a-terminal', skillName: 'worker', contentKind: 'federated-skill', codexModel: 'gpt-5.5', codexEffort: 'high' },
          ],
        },
        {
          id: 'step-b', name: 'Step B', purpose: '', createdAt: now, updatedAt: now,
          skills: [{ id: 'skill-b', skillName: 'worker', contentKind: 'federated-skill', codexModel: 'gpt-5.5', codexEffort: 'high' }],
        },
      ],
      runs: [],
      skillLibrary: [],
      authoredContent: [
        { id: 'SYSTEM_PROMPT', kind: 'pipeline-prompt', description: 'System', contentFile: 'pipeline-prompts/SYSTEM_PROMPT.md', createdAt: now, updatedAt: now },
        { id: 'SKILL', kind: 'pipeline-prompt', description: 'Skill', contentFile: 'pipeline-prompts/SKILL.md', createdAt: now, updatedAt: now },
      ],
      activeWorkspaceRun: null,
    },
  });
  return { workspace, decisionOsRoot };
}

test('a running thread queues one idempotent saved pipeline in the same task', async () => {
  const fixture = createWorkspace();
  const runtime: Record<string, unknown> = { decisionOsRoot: fixture.decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const state = taskExecutionState(runtime);
    assert.ok(state);
    const executionId = 'thread-execution';
    await state.executions.admit({
      metadata: {
        executionId,
        requestId: 'thread-request',
        sessionId: 'thread-session',
        projectId: state.store.activeDelta().projectId,
        ledgerId: 'specs',
        taskId: 'source-card',
        sourceCardId: 'source-card',
        ownerCardId: 'source-card',
        kind: 'thread',
        requestedAt: '2026-08-14T00:01:00.000Z',
        model: 'gpt-5.6-sol',
        effort: 'medium',
        pipelineRunId: null,
        pipelineStepId: null,
        pipelineSkillRunId: null,
        predecessorExecutionId: null,
        restartOfExecutionId: null,
      },
      executorNodeId: taskExecutionNodeId(runtime),
    });
    await state.executions.transition(executionId, { phase: 'queued' });
    await state.executions.transition(executionId, { phase: 'starting' });
    await state.executions.transition(executionId, { phase: 'running' });

    const queue = (pipelineId: string) => fetch(`${baseUrl}/api/codex/executions/${executionId}/queue-pipeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipelineId }),
    });
    const responses = await Promise.all([queue('pipeline-a'), queue('pipeline-a')]);
    const bodies = await Promise.all(responses.map((response) => response.json() as Promise<Record<string, any>>));
    assert.deepEqual(responses.map((response) => response.status), [202, 202]);
    assert.equal(new Set(bodies.map((body) => body.run.id)).size, 1);
    assert.deepEqual(bodies.map((body) => body.idempotent === true).sort(), [false, true]);
    const admitted = bodies.find((body) => body.idempotent !== true);
    assert.ok(admitted);
    assert.equal(admitted.run.pipelineId, 'pipeline-a');
    assert.equal(admitted.run.ledgerId, 'specs');
    assert.equal(admitted.run.sourceCardId, 'source-card');
    assert.equal(admitted.run.queuedAfterExecutionId, executionId);
    const successorExecutionId = admitted.run.steps[0].skills[0].executionId;
    const terminalExecutionId = admitted.run.steps[0].skills[1].executionId;
    const successor = state.executions.find(successorExecutionId);
    assert.equal(successor?.metadata.taskId, 'source-card');
    assert.equal(successor?.metadata.predecessorExecutionId, executionId);
    assert.equal(successor?.lifecycle.phase, 'queued');

    const conflict = await queue('pipeline-b');
    const conflictBody = await conflict.json() as Record<string, unknown>;
    assert.equal(conflict.status, 409);
    assert.equal(conflictBody.code, 'dynamic_pipeline_already_queued');

    await state.executions.transition(executionId, { phase: 'succeeded', result: { status: 'succeeded', summary: 'Thread settled.' } });
    await state.executions.transition(successorExecutionId, { phase: 'starting' });
    await state.executions.transition(successorExecutionId, { phase: 'running' });
    const nonterminal = await fetch(`${baseUrl}/api/codex/executions/${successorExecutionId}/queue-pipeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipelineId: 'pipeline-b' }),
    });
    assert.equal(nonterminal.status, 409);
    assert.equal((await nonterminal.json() as Record<string, unknown>).code, 'dynamic_pipeline_caller_not_terminal');

    await state.executions.transition(successorExecutionId, { phase: 'succeeded', result: { status: 'succeeded', summary: 'First skill settled.' } });
    await state.executions.transition(terminalExecutionId, { phase: 'starting' });
    await state.executions.transition(terminalExecutionId, { phase: 'running' });
    const chainedResponse = await fetch(`${baseUrl}/api/codex/executions/${terminalExecutionId}/queue-pipeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipelineId: 'pipeline-b' }),
    });
    const chained = await chainedResponse.json() as Record<string, any>;
    assert.equal(chainedResponse.status, 202, JSON.stringify(chained));
    assert.equal(chained.run.queuedAfterExecutionId, terminalExecutionId);
    assert.equal(chained.run.initialInputCardId, admitted.run.steps[0].outputCardId);
    const chainedExecutionId = chained.run.steps[0].skills[0].executionId;
    assert.equal(state.executions.find(chainedExecutionId)?.metadata.predecessorExecutionId, terminalExecutionId);
    assert.equal(state.executions.find(chainedExecutionId)?.lifecycle.phase, 'queued');

    const cancel = await fetch(`${baseUrl}/api/codex/pipelines/runs/${chained.run.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ executionId: chainedExecutionId }),
    });
    assert.equal(cancel.status, 202);
    await state.executions.transition(terminalExecutionId, { phase: 'succeeded', result: { status: 'succeeded', summary: 'Terminal skill settled.' } });
  } finally {
    await closeServer(server);
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
});
