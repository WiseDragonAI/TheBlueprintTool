/**
 * WHAT: Projects a legacy card-run status response from replicated execution state and pushed presentation events.
 * WHY: Existing Process Card widgets must keep working while their browser polls stop at the local backend.
 */
import type { TaskExecutionPresentationEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ReplicatedTaskExecutionRecord } from '../../task-state/helper/task-execution-repository.js';

function statusForPhase(phase: string): 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running' || phase === 'cancelling') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function presentationText(event: TaskExecutionPresentationEvent): string {
  if (event.kind === 'tool_call') return event.command;
  if (event.kind === 'file_change') return event.files.map((file) => `${file.path}: ${file.action}`).join('\n');
  if (event.kind === 'todo_list') return event.items.map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.text}`).join('\n');
  if (event.kind === 'subagent') return [event.skillName, event.model, event.effort].filter(Boolean).join(' · ');
  return event.text;
}

export function replicatedCardSkillRunStatus(input: {
  runId: string;
  ledgerId: string;
  cardId: string;
  executions: readonly ReplicatedTaskExecutionRecord[];
  events: readonly TaskExecutionPresentationEvent[];
  queuePosition?: number | null;
}): Record<string, unknown> {
  const history = input.executions
    .filter((record) => record.metadata.sessionId === input.runId
      && record.metadata.ledgerId === input.ledgerId
      && (record.metadata.sourceCardId === input.cardId || record.metadata.ownerCardId === input.cardId))
    .sort((left, right) => left.metadata.requestedAt.localeCompare(right.metadata.requestedAt)
      || left.metadata.executionId.localeCompare(right.metadata.executionId));
  const execution = history.at(-1);
  if (!execution) return { ok: false, statusCode: 404, error: 'Execution not found.', runId: input.runId };
  const status = statusForPhase(execution.lifecycle.phase);
  const startedAt = execution.lifecycle.startedAt ?? execution.metadata.requestedAt;
  const finishedAt = execution.lifecycle.finishedAt;
  const elapsedMs = Math.max(0, Date.parse(finishedAt ?? new Date().toISOString()) - Date.parse(startedAt));
  const counts = {
    toolCallCount: input.events.filter((event) => event.kind === 'tool_call').length,
    agentMessageCount: input.events.filter((event) => event.kind === 'agent_message').length,
    fileChangeCount: input.events.filter((event) => event.kind === 'file_change').length,
    thinkingCount: input.events.filter((event) => event.kind === 'thinking').length,
    warningCount: input.events.filter((event) => event.kind === 'warning').length,
    errorCount: input.events.filter((event) => event.kind === 'error').length,
  };
  const events = input.events.map((event, index) => ({
    runId: input.runId,
    line: index + 1,
    source: 'jsonl',
    sourceLine: index + 1,
    type: event.kind,
    kind: event.kind,
    title: event.title,
    text: presentationText(event),
    status: event.status,
    itemId: event.id,
    tool: event.kind === 'tool_call' ? event.command : '',
    output: '',
    exitCode: event.kind === 'tool_call' ? event.exitCode : '',
    severity: event.severity,
    persist: false,
  }));
  const executionHistory = history.map((record) => ({
    executionId: record.metadata.executionId,
    runId: record.metadata.sessionId,
    segment: record.metadata.predecessorExecutionId ? 'continue' : 'start',
    startedAt: record.lifecycle.startedAt ?? record.metadata.requestedAt,
    turnStartedAt: record.lifecycle.startedAt ?? record.metadata.requestedAt,
    startLine: 0,
    turnStartLine: 0,
    endLine: null,
    status: statusForPhase(record.lifecycle.phase),
    active: ['starting', 'running', 'cancelling'].includes(record.lifecycle.phase),
    finishedAt: record.lifecycle.finishedAt ?? '',
    elapsedMs: Math.max(0, Date.parse(record.lifecycle.finishedAt ?? new Date().toISOString())
      - Date.parse(record.lifecycle.startedAt ?? record.metadata.requestedAt)),
    ...counts,
    transportStatus: 'ok',
  }));
  return {
    ok: true,
    statusCode: 200,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    runKind: execution.metadata.kind === 'pipeline-skill' ? 'card' : 'thread',
    pipelineRunId: execution.metadata.pipelineRunId ?? '',
    pipelineName: '',
    pipelineStepName: '',
    skillName: '',
    pipelineStatus: '',
    status,
    active: ['starting', 'running', 'cancelling'].includes(execution.lifecycle.phase),
    phase: execution.lifecycle.phase,
    phaseSince: execution.lifecycle.phaseSince,
    lifecycleRevision: execution.lifecycle.revision,
    executorNodeId: execution.lifecycle.executorNodeId,
    execution: {
      ...execution.metadata,
      ...execution.lifecycle,
      artifacts: execution.artifacts,
    },
    executionId: execution.metadata.executionId,
    currentExecution: executionHistory.at(-1),
    executions: executionHistory,
    startedAt,
    finishedAt: finishedAt ?? '',
    elapsedMs,
    lineCount: events.length,
    nextSince: events.length,
    ...counts,
    transportStatus: 'ok',
    persistedEventCount: 0,
    queuePosition: input.queuePosition ?? null,
    metadata: {
      sourceCardTitle: '',
      sourceThreadId: `thread-${execution.metadata.sourceCardId}`,
      codexModel: execution.metadata.model ?? '',
      codexEffort: execution.metadata.effort ?? '',
    },
    latestEvent: events.at(-1) ?? null,
    events,
    diagnostics: [],
    artifacts: execution.artifacts,
  };
}
