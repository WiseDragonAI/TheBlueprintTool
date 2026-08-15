/**
 * WHAT: Queues one saved pipeline after a running thread, continuation, or terminal pipeline execution.
 * WHY: Active agents need a durable same-task successor without constructing pipeline topology themselves.
 */
import { resolve } from 'node:path';
import { assertCodexPipelineStoreAvailable, readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';
import { withCardCodexAdmission } from '../helper/card-codex-admission-lock.js';
import { startCodexPipelineRunController } from './start-codex-pipeline-run-controller.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function queueCodexPipelineAfterExecutionController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; admissionLocked?: boolean } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; admissionLocked?: boolean };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const executionId = text(payload.executionId);
  const pipelineId = text(payload.pipelineId);
  // WHAT: Require the caller and saved-pipeline identities before reading durable execution state.
  // WHY: Neither identity can be inferred safely from another active execution or pipeline.
  if (!executionId || !pipelineId) {
    return { ok: false, statusCode: 400, error: 'Missing executionId or pipelineId.' };
  }
  const state = taskExecutionState(runtime);
  // WHAT: Reject scheduling while replicated execution authority is unavailable.
  // WHY: A successor cannot be linked safely without its durable predecessor record.
  if (!state) {
    return { ok: false, statusCode: 503, code: 'task_execution_state_unavailable', error: 'Replicated task execution state is unavailable.' };
  }
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const existing = normalized.store.runs.find((run) => run.queuedAfterExecutionId === executionId);
  // WHAT: Make one caller own at most one exact saved-pipeline successor.
  // WHY: Concurrent retries must not create duplicate topology or replace an admitted choice.
  if (existing) {
    // WHAT: Reject a different pipeline after this execution has selected its successor.
    // WHY: Reusing one predecessor for competing topologies would make retry intent ambiguous.
    if (existing.pipelineId !== pipelineId) {
      return {
        ok: false,
        statusCode: 409,
        code: 'dynamic_pipeline_already_queued',
        error: 'This execution already queued a different successor pipeline.',
        pipelineRunId: existing.id,
      };
    }
    return { ok: true, statusCode: 202, idempotent: true, run: existing };
  }
  const currentExecution = state.executions.find(executionId);
  // WHAT: Reject unknown callers before resolving task ownership.
  // WHY: Pipeline admission must be anchored to one authoritative execution.
  if (!currentExecution) {
    return { ok: false, statusCode: 404, code: 'task_execution_not_found', error: 'Calling execution was not found.', executionId };
  }
  // WHAT: Permit successor selection only while the caller is still running.
  // WHY: The command belongs to the active turn and must not alter terminal history.
  if (currentExecution.lifecycle.phase !== 'running') {
    return {
      ok: false,
      statusCode: 409,
      code: 'task_execution_not_running',
      error: 'Only a running execution can queue its successor pipeline.',
      phase: currentExecution.lifecycle.phase,
    };
  }
  const callerKind = currentExecution.metadata.kind;
  let initialInputCardId = '';
  // WHAT: Resolve pipeline callers through their immutable manifest and preserve their direct output handoff.
  // WHY: A saved successor must not branch before queued descendants or restart from the original source card.
  if (callerKind === 'pipeline-skill') {
    const currentRun = normalized.store.runs.find((run) => run.id === currentExecution.metadata.pipelineRunId);
    const topology = currentRun?.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill }))) ?? [];
    const callerIndex = topology.findIndex(({ skill }) => skill.executionId === executionId);
    // WHAT: Reject a pipeline caller that is absent from its declared immutable run.
    // WHY: Terminal position and direct input ownership cannot be derived safely without that manifest member.
    if (!currentRun || callerIndex < 0) {
      return { ok: false, statusCode: 409, code: 'dynamic_pipeline_manifest_missing', error: 'Calling execution has no immutable pipeline manifest.' };
    }
    // WHAT: Allow only the final execution in a pipeline run to select a saved successor.
    // WHY: Earlier members already own queued descendants and cannot create a competing branch.
    if (callerIndex !== topology.length - 1) {
      return { ok: false, statusCode: 409, code: 'dynamic_pipeline_caller_not_terminal', error: 'Only the terminal pipeline execution can queue a successor pipeline.' };
    }
    initialInputCardId = topology[callerIndex].step.outputCardId;
  // WHAT: Reject execution kinds that do not own a Codex conversation or pipeline turn.
  // WHY: Voice and unsupported runtime records cannot safely select a same-task successor.
  } else if (callerKind !== 'thread' && callerKind !== 'continuation') {
    return { ok: false, statusCode: 409, code: 'dynamic_pipeline_caller_invalid', error: 'Calling execution cannot queue a pipeline.' };
  }
  const ledgerId = currentExecution.metadata.ledgerId;
  const sourceCardId = currentExecution.metadata.sourceCardId;
  // WHAT: Serialize successor admission with every other Codex start on the source card.
  // WHY: Concurrent requests must observe the first committed successor before creating another run.
  if (!envelope.admissionLocked) {
    return withCardCodexAdmission(
      { decisionOsRoot, ledgerId, cardId: sourceCardId },
      () => queueCodexPipelineAfterExecutionController({
        action_payload: payload,
        runtime_state: runtime,
        admissionLocked: true,
      }),
    );
  }
  return startCodexPipelineRunController({
    action_payload: {
      ledgerId,
      sourceCardId,
      pipelineId,
      onLedgerChange: payload.onLedgerChange,
    },
    runtime_state: runtime,
    admissionLocked: true,
    queuedAfterExecutionId: executionId,
    initialInputCardId,
  });
}
