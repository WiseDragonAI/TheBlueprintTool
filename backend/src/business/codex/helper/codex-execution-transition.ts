/**
 * WHAT: Creates and transitions one canonical Codex execution record.
 * WHY: Legal phases, timestamps, result settlement, and revision order must be identical for every launch kind.
 */
import {
  codexExecutionPhases,
  type CodexExecutionError,
  type CodexExecutionKind,
  type CodexExecutionPhase,
  type CodexExecutionRecord,
  type CodexExecutionResult,
} from '../../../../../shared/schemas/codex-execution-types.js';

const phases = new Set<CodexExecutionPhase>(codexExecutionPhases);
const terminalPhases = new Set<CodexExecutionPhase>(['succeeded', 'failed', 'cancelled', 'interrupted']);
const transitions: Readonly<Record<CodexExecutionPhase, ReadonlySet<CodexExecutionPhase>>> = {
  preparing: new Set(['queued', 'succeeded', 'failed', 'cancelled']),
  queued: new Set(['starting', 'cancelled', 'interrupted']),
  starting: new Set(['running', 'failed', 'cancelled', 'interrupted']),
  running: new Set(['cancelling', 'succeeded', 'failed', 'cancelled', 'interrupted']),
  cancelling: new Set(['failed', 'cancelled', 'interrupted']),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  interrupted: new Set(['queued', 'cancelled']),
};

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`codex_execution_${field}_required`);
  return text;
}

function iso(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`codex_execution_${field}_invalid`);
  return text;
}

export function isTerminalCodexExecutionPhase(phase: CodexExecutionPhase): boolean {
  return terminalPhases.has(phase);
}

export function assertCodexExecutionRecord(record: CodexExecutionRecord): void {
  requiredText(record.executionId, 'id');
  requiredText(record.sessionId, 'session_id');
  requiredText(record.projectId, 'project_id');
  requiredText(record.ledgerId, 'ledger_id');
  requiredText(record.taskId, 'task_id');
  requiredText(record.ownerCardId, 'owner_card_id');
  if (!['thread', 'continuation', 'voice', 'pipeline-skill'].includes(record.kind)) throw new Error('codex_execution_kind_invalid');
  if (!phases.has(record.phase)) throw new Error('codex_execution_phase_invalid');
  iso(record.requestedAt, 'requested_at');
  iso(record.phaseSince, 'phase_since');
  if (record.startedAt !== null) iso(record.startedAt, 'started_at');
  if (record.finishedAt !== null) iso(record.finishedAt, 'finished_at');
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error('codex_execution_revision_invalid');
  if (record.processId !== null && (!Number.isSafeInteger(record.processId) || record.processId < 1)) throw new Error('codex_execution_process_id_invalid');
  if (isTerminalCodexExecutionPhase(record.phase) !== Boolean(record.finishedAt)) throw new Error('codex_execution_terminal_timestamp_invalid');
  if (record.phase === 'succeeded' && record.result?.status !== 'succeeded') throw new Error('codex_execution_result_invalid');
  if (record.phase === 'failed' && (record.result?.status !== 'failed' || !record.error)) throw new Error('codex_execution_failure_invalid');
  if (record.phase === 'cancelled' && record.result?.status !== 'cancelled') throw new Error('codex_execution_result_invalid');
  if (record.phase === 'interrupted' && record.result?.status !== 'interrupted') throw new Error('codex_execution_result_invalid');
  if (!isTerminalCodexExecutionPhase(record.phase) && (record.result !== null || record.error !== null || record.finishedAt !== null)) throw new Error('codex_execution_active_settlement_invalid');
  if ((record.phase === 'starting' || record.phase === 'running' || record.phase === 'cancelling') && (!record.startedAt || !record.executorNodeId)) throw new Error('codex_execution_executor_invalid');
  if (record.kind === 'pipeline-skill' && (!record.pipelineRunId || !record.pipelineStepId || !record.pipelineSkillRunId)) throw new Error('codex_execution_pipeline_identity_invalid');
}

export function createCodexExecutionRecord(input: {
  executionId: string;
  sessionId: string;
  projectId: string;
  ledgerId: string;
  taskId: string;
  ownerCardId: string;
  kind: CodexExecutionKind;
  pipelineRunId?: string | null;
  pipelineStepId?: string | null;
  pipelineSkillRunId?: string | null;
  requestedAt?: string;
}): CodexExecutionRecord {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const record: CodexExecutionRecord = {
    executionId: requiredText(input.executionId, 'id'),
    sessionId: requiredText(input.sessionId, 'session_id'),
    projectId: requiredText(input.projectId, 'project_id'),
    ledgerId: requiredText(input.ledgerId, 'ledger_id'),
    taskId: requiredText(input.taskId, 'task_id'),
    ownerCardId: requiredText(input.ownerCardId, 'owner_card_id'),
    kind: input.kind,
    pipelineRunId: input.pipelineRunId ? String(input.pipelineRunId) : null,
    pipelineStepId: input.pipelineStepId ? String(input.pipelineStepId) : null,
    pipelineSkillRunId: input.pipelineSkillRunId ? String(input.pipelineSkillRunId) : null,
    phase: 'preparing',
    requestedAt: iso(requestedAt, 'requested_at'),
    phaseSince: requestedAt,
    startedAt: null,
    finishedAt: null,
    executorNodeId: null,
    processId: null,
    processStartTime: null,
    stdoutFile: null,
    stderrFile: null,
    result: null,
    error: null,
    revision: 1,
  };
  assertCodexExecutionRecord(record);
  return record;
}

export function transitionCodexExecution(input: {
  record: CodexExecutionRecord;
  expectedExecutionId: string;
  phase: CodexExecutionPhase;
  changedAt?: string;
  executorNodeId?: string;
  processId?: number | null;
  processStartTime?: string | null;
  stdoutFile?: string | null;
  stderrFile?: string | null;
  result?: CodexExecutionResult | null;
  error?: CodexExecutionError | null;
}): CodexExecutionRecord {
  assertCodexExecutionRecord(input.record);
  if (input.record.executionId !== input.expectedExecutionId) throw new Error('codex_execution_identity_mismatch');
  if (!transitions[input.record.phase].has(input.phase)) throw new Error(`codex_execution_transition_invalid:${input.record.phase}:${input.phase}`);
  const changedAt = iso(input.changedAt ?? new Date().toISOString(), 'phase_since');
  const terminal = isTerminalCodexExecutionPhase(input.phase);
  const requeued = input.record.phase === 'interrupted' && input.phase === 'queued';
  const executorNodeId = requeued
    ? null
    : input.executorNodeId === undefined ? input.record.executorNodeId : requiredText(input.executorNodeId, 'executor_node_id');
  const result = terminal
    ? input.result ?? { status: input.phase as CodexExecutionResult['status'], summary: '' }
    : null;
  const error = input.phase === 'failed'
    ? input.error ?? { code: 'codex_execution_failed', message: 'Codex execution failed.' }
    : null;
  const record: CodexExecutionRecord = {
    ...input.record,
    phase: input.phase,
    phaseSince: changedAt,
    startedAt: requeued ? null : input.record.startedAt ?? (input.phase === 'starting' || input.phase === 'running' ? changedAt : null),
    finishedAt: terminal ? changedAt : null,
    executorNodeId,
    processId: requeued ? null : input.processId === undefined ? input.record.processId : input.processId,
    processStartTime: requeued ? null : input.processStartTime === undefined ? input.record.processStartTime : input.processStartTime,
    stdoutFile: input.stdoutFile === undefined ? input.record.stdoutFile : input.stdoutFile,
    stderrFile: input.stderrFile === undefined ? input.record.stderrFile : input.stderrFile,
    result,
    error,
    revision: input.record.revision + 1,
  };
  assertCodexExecutionRecord(record);
  return record;
}
