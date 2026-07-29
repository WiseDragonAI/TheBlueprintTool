/**
 * WHAT: Verifies exact execution segmentation and lightweight public presentation.
 * WHY: Raw tool results and neighboring execution events must never cross the backend response boundary.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { buildTaskExecutionPresentation } from '@backend/business/codex/helper/task-execution-presentation.js';
import { normalizeCardSkillRunEvent } from '@backend/business/codex/helper/normalize-card-skill-run-event.js';
import { taskExecutionPresentationEvents } from '@backend/business/codex/helper/task-execution-presentation-events.js';
import type { ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';

function record(executionId: string, requestedAt: string) {
  return {
    metadata: {
      executionId,
      requestId: `request-${executionId}`,
      sessionId: 'session-a',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'task-a',
      sourceCardId: 'task-a',
      ownerCardId: 'task-a',
      kind: 'thread' as const,
      requestedAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: {
      phase: 'running' as const,
      phaseSince: requestedAt,
      startedAt: requestedAt,
      finishedAt: null,
      executorNodeId: 'local',
      providerSessionId: null,
      result: null,
      error: null,
      revision: 3,
    },
    artifacts: {
      jsonl: null,
      stderr: null,
      telemetry: null,
      result: null,
      changedAt: requestedAt,
      revision: 1,
    },
  };
}

test('collapses legacy captured prompts and both start records into one user prompt card', () => {
  const events = [
    { type: 'decision_os.developer_prompt', prompt: 'Legacy captured prompt.' },
    { type: 'thread.started' },
    { type: 'turn.started' },
  ].map((event, index) => normalizeCardSkillRunEvent({ line: index + 1, event }));
  assert.deepEqual(taskExecutionPresentationEvents(events), [{
    id: 'run_status:user-prompt',
    kind: 'run_status',
    title: 'User prompt',
    status: 'running',
    text: 'Legacy captured prompt.',
    severity: 'info',
  }]);
});

test('returns one exact snapshot with typed todos and no raw tool result bytes', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-execution-presentation-'));
  const jsonlFile = join(workspace, 'session.jsonl');
  const stderrFile = join(workspace, 'session.log');
  const sentinel = `RAW_TOOL_RESULT_${'x'.repeat(250_000)}`;
  const first = record('execution-1', '2026-07-25T01:00:00.000Z');
  const second = record('execution-2', '2026-07-25T02:00:00.000Z');
  const userPrompt = '# Gate prompt\n\nUse the complete task context.';
  writeFileSync(jsonlFile, [
    JSON.stringify({ type: 'decision_os.user_prompt', prompt: userPrompt }),
    JSON.stringify({ type: 'thread.started', thread_id: 'provider-thread' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'item.started', item: { id: 'tool-1', type: 'command_execution', command: 'rg TODO', status: 'in_progress', aggregated_output: sentinel } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'tool-1', type: 'command_execution', command: 'rg TODO', status: 'completed', exit_code: 0, aggregated_output: sentinel } }),
    JSON.stringify({ type: 'item.updated', item: { id: 'todo-1', type: 'todo_list', items: [{ text: 'Inspect', completed: true }, { text: 'Render', completed: false }] } }),
    JSON.stringify({ type: 'item.started', item: { id: 'subagent-1', type: 'command_execution', command: "ledger-cli queue-skill --skill product-analysis --model gpt-5.6-luna --effort low", status: 'in_progress' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'subagent-1', type: 'command_execution', command: "ledger-cli queue-skill --skill product-analysis --model gpt-5.6-luna --effort low", status: 'completed', exit_code: 0, aggregated_output: 'Queued product-analysis.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: 'First execution message.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'comment-1', type: 'comment', text: 'Execution comment.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'message-2', type: 'agent_message', text: 'Second execution message.' } }),
  ].join('\n'));
  writeFileSync(stderrFile, [
    `decision-os:codex-run-segment ${JSON.stringify({ runId: 'session-a', executionId: 'execution-1', startedAt: first.metadata.requestedAt, segment: 'start', startLine: 0 })}`,
    `decision-os:codex-run-segment ${JSON.stringify({ runId: 'session-a', executionId: 'execution-2', startedAt: second.metadata.requestedAt, segment: 'continue', startLine: 10 })}`,
  ].join('\n'));
  const records = [first, second];
  const state = {
    executions: {
      find: (executionId: string) => records.find((entry) => entry.metadata.executionId === executionId) ?? null,
      bySessionId: () => records,
    },
  } as unknown as ProjectTaskState;
  const runtime = {
    taskExecutionNodeId: 'local',
    taskExecutionProcesses: new Map([['execution-1', {
      executionId: 'execution-1',
      sessionId: 'session-a',
      child: {} as ChildProcess,
      processId: 1,
      processStartTime: '',
      startedAt: first.metadata.requestedAt,
      stdoutFile: jsonlFile,
      stderrFile,
    }]]),
  };

  try {
    const result = buildTaskExecutionPresentation({ executionId: 'execution-1', state, runtime });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.presentation);
    assert.equal(serialized.includes('RAW_TOOL_RESULT_'), false);
    assert.equal(serialized.includes('"line"'), false);
    assert.equal(serialized.includes('"output"'), false);
    assert.equal(serialized.includes('Second execution message.'), false);
    assert.ok(serialized.length < 10_000);
    assert.deepEqual(result.presentation.events, [
      {
        id: 'run_status:user-prompt',
        kind: 'run_status',
        title: 'User prompt',
        status: 'running',
        text: userPrompt,
        severity: 'info',
      },
      {
        id: 'tool_call:tool-1',
        kind: 'tool_call',
        title: 'rg TODO',
        command: 'rg TODO',
        status: 'completed',
        exitCode: '0',
        severity: 'info',
      },
      {
        id: 'todo_list:todo-1',
        kind: 'todo_list',
        title: 'Todo list',
        status: 'in_progress',
        items: [{ text: 'Inspect', completed: true }, { text: 'Render', completed: false }],
        severity: 'info',
      },
      {
        id: 'subagent:subagent-1',
        kind: 'subagent',
        title: 'Subagent · product-analysis',
        status: 'completed',
        severity: 'info',
        skillName: 'product-analysis',
        model: 'gpt-5.6-luna',
        effort: 'low',
      },
      {
        id: 'tool_call:subagent-1',
        kind: 'tool_call',
        title: 'ledger-cli queue-skill --skill product-analysis --model gpt-5.6-luna --effort low',
        command: 'ledger-cli queue-skill --skill product-analysis --model gpt-5.6-luna --effort low',
        status: 'completed',
        exitCode: '0',
        severity: 'info',
      },
      {
        id: 'agent_message:message-1',
        kind: 'agent_message',
        title: 'Codex message',
        status: '',
        text: 'First execution message.',
        severity: 'info',
      },
      {
        id: 'comment:comment-1',
        kind: 'comment',
        title: 'Codex comment',
        status: '',
        text: 'Execution comment.',
        severity: 'info',
      },
    ]);
    assert.equal(result.presentation.execution.counts.comments, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects a markerless artifact shared by several executions', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-markerless-presentation-'));
  const jsonlFile = join(workspace, 'session.jsonl');
  const stderrFile = join(workspace, 'session.log');
  writeFileSync(jsonlFile, JSON.stringify({ type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: 'Ambiguous.' } }));
  writeFileSync(stderrFile, '');
  const first = record('execution-1', '2026-07-25T01:00:00.000Z');
  const second = record('execution-2', '2026-07-25T02:00:00.000Z');
  const state = {
    executions: {
      find: () => first,
      bySessionId: () => [first, second],
    },
  } as unknown as ProjectTaskState;
  try {
    const result = buildTaskExecutionPresentation({
      executionId: 'execution-1',
      state,
      runtime: {
        taskExecutionNodeId: 'local',
        taskExecutionProcesses: new Map([['execution-1', {
          executionId: 'execution-1',
          sessionId: 'session-a',
          child: {} as ChildProcess,
          processId: 1,
          processStartTime: '',
          startedAt: first.metadata.requestedAt,
          stdoutFile: jsonlFile,
          stderrFile,
        }]]),
      },
    });
    assert.deepEqual(result, {
      ok: false,
      statusCode: 409,
      error: 'execution_presentation_boundary_unavailable',
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
