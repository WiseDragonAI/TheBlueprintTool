/**
 * WHAT: Returns lifecycle-only skill and pipeline projections from replicated executions.
 * WHY: Compact status must not read queue files, card leases, mutable manifest phases, runtime aliases, or logs.
 */
import { resolve } from 'node:path';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { replicatedPipelineRun } from '../helper/codex-pipeline-runner.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';
import type { ReplicatedTaskExecutionRecord } from '../../task-state/helper/task-execution-repository.js';

type AnyRecord = Record<string, unknown>;

function statusForPhase(phase: string): string {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running' || phase === 'cancelling') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function elapsedMs(startedAt: unknown, finishedAt: unknown): number | null {
  const started = Date.parse(String(startedAt ?? ''));
  if (!Number.isFinite(started)) return null;
  const finished = Date.parse(String(finishedAt ?? ''));
  return Math.max(0, (Number.isFinite(finished) ? finished : Date.now()) - started);
}

function validActions(execution: ReplicatedTaskExecutionRecord): string[] {
  if (execution.lifecycle.phase === 'preparing' || execution.lifecycle.phase === 'queued') return ['cancel'];
  if (execution.lifecycle.phase === 'starting' || execution.lifecycle.phase === 'running') return ['cancel', 'open-log'];
  if (execution.lifecycle.phase === 'cancelling') return ['open-log'];
  return ['restart', 'open-log'];
}

function assignedNodeId(runtime: AnyRecord, execution: ReplicatedTaskExecutionRecord): string {
  const cards = taskExecutionState(runtime)?.projection().ledger.cards;
  const task = Array.isArray(cards)
    ? cards.find((card) => String((card as AnyRecord).id ?? '') === execution.metadata.taskId) as AnyRecord | undefined
    : undefined;
  const assignment = task?.assignment && typeof task.assignment === 'object' && !Array.isArray(task.assignment)
    ? task.assignment as AnyRecord
    : {};
  return String(assignment.nodeId ?? execution.lifecycle.executorNodeId);
}

function replicatedStatus(input: {
  runtime: AnyRecord;
  execution: ReplicatedTaskExecutionRecord;
  decisionOsRoot: string;
}): AnyRecord {
  const { execution } = input;
  return {
    status: statusForPhase(execution.lifecycle.phase),
    phase: execution.lifecycle.phase,
    active: ['preparing', 'queued', 'starting', 'running', 'cancelling'].includes(execution.lifecycle.phase),
    startedAt: execution.lifecycle.startedAt ?? '',
    finishedAt: execution.lifecycle.finishedAt ?? '',
    phaseSince: execution.lifecycle.phaseSince,
    elapsedMs: elapsedMs(execution.lifecycle.startedAt ?? execution.metadata.requestedAt, execution.lifecycle.finishedAt),
    error: execution.lifecycle.error?.message ?? '',
    lifecycleRevision: execution.lifecycle.revision,
    assignedNodeId: assignedNodeId(input.runtime, execution),
    executorNodeId: execution.lifecycle.executorNodeId,
    validActions: validActions(execution),
    queuePosition: execution.lifecycle.phase === 'queued'
      ? unifiedCodexQueuePosition({
          decisionOsRoot: input.decisionOsRoot,
          id: execution.metadata.executionId,
          createdAt: execution.metadata.requestedAt,
          runtime: input.runtime,
        })
      : null,
    pipelineRunId: execution.metadata.pipelineRunId,
    execution: {
      ...execution.metadata,
      ...execution.lifecycle,
      artifacts: execution.artifacts,
      validActions: validActions(execution),
    },
  };
}

export function readCompactSkillRunStatusController(input: { runId: string; ledgerId: string; cardId: string; runtime: AnyRecord }): AnyRecord {
  const { runId, ledgerId, cardId, runtime } = input;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  if (!runId || !ledgerId || !cardId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };
  const execution = taskExecutionState(runtime)?.executions.bySessionId(runId)
    .filter((candidate) => candidate.metadata.ledgerId === ledgerId
      && (candidate.metadata.sourceCardId === cardId || candidate.metadata.ownerCardId === cardId))
    .sort((left, right) => right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
      || right.metadata.executionId.localeCompare(left.metadata.executionId))[0] ?? null;
  if (!execution) return { ok: false, statusCode: 404, error: 'Execution not found.' };
  return {
    ok: true,
    statusCode: 200,
    runId,
    kind: 'skill',
    ledgerId,
    cardId,
    ...replicatedStatus({ runtime, execution, decisionOsRoot }),
  };
}

export function readCompactPipelineRunStatusController(input: { runId: string; runtime: AnyRecord }): AnyRecord {
  const decisionOsRoot = resolve(String(input.runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const stored = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === input.runId);
  if (!stored) return { ok: false, statusCode: 404, error: 'Pipeline run not found.' };
  const run = replicatedPipelineRun(stored, input.runtime);
  const executions = taskExecutionState(input.runtime)?.executions.byPipelineRunId(stored.id) ?? [];
  if (!run || executions.length === 0) return { ok: false, statusCode: 404, error: 'Pipeline executions not found.' };
  const active = executions.find((execution) => ['preparing', 'queued', 'starting', 'running', 'cancelling'].includes(execution.lifecycle.phase));
  const selected = active ?? executions.at(-1)!;
  const detail = replicatedStatus({ runtime: input.runtime, execution: selected, decisionOsRoot });
  return {
    ok: true,
    statusCode: 200,
    runId: run.id,
    kind: 'pipeline',
    ledgerId: run.ledgerId,
    cardId: selected.metadata.ownerCardId,
    ...detail,
    status: run.status,
    active: run.status === 'pending' || run.status === 'running',
    startedAt: run.startedAt ?? '',
    finishedAt: run.finishedAt ?? '',
    elapsedMs: elapsedMs(run.startedAt ?? run.createdAt, run.finishedAt),
    error: run.status === 'failed' ? run.error : '',
  };
}
