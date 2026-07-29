/**
 * WHAT: Appends one immutable work-then-caller segment after a running Codex skill execution.
 * WHY: A full-power pipeline gate must choose its next skill without mutating its current run or emitting a decision schema.
 */
import { resolve } from 'node:path';
import type {
  CodexContentKind,
  CodexEffort,
  CodexModel,
  CodexPipelineRun,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { assertCodexPipelineStoreAvailable, readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import {
  assertPipelinePromptRunSkillSnapshot,
  type AdmittedPipelinePromptSnapshot,
} from '../helper/pipeline-prompt-snapshot.js';
import { isAllowedCodexEffort, isAllowedCodexModel } from '../helper/resolve-codex-command.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';
import { withCardCodexAdmission } from '../helper/card-codex-admission-lock.js';
import { startPipelineRun } from './start-codex-pipeline-run-controller.js';
import { availablePipelineContent } from '../helper/available-pipeline-content.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function runMember(run: CodexPipelineRun, executionId: string) {
  return run.steps
    .flatMap((step) => step.skills.map((skill) => ({ step, skill })))
    .find(({ skill }) => skill.executionId === executionId) ?? null;
}

function sameQueuedRequest(input: {
  run: CodexPipelineRun;
  skillName: string;
  codexModel: CodexModel;
  codexEffort: CodexEffort;
}): boolean {
  const first = input.run.steps[0]?.skills[0];
  return Boolean(
    first
    && first.skillName === input.skillName
    && first.codexModel === input.codexModel
    && first.codexEffort === input.codexEffort,
  );
}

export async function queueCodexSkillAfterExecutionController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; admissionLocked?: boolean } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; admissionLocked?: boolean };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const executionId = text(payload.executionId);
  const skillName = text(payload.skillName);
  const requestedModel = text(payload.codexModel);
  const requestedEffort = text(payload.codexEffort);
  if (!executionId || !skillName || !requestedModel || !requestedEffort) {
    return { ok: false, statusCode: 400, error: 'Missing executionId, skillName, codexModel, or codexEffort.' };
  }
  if (!isAllowedCodexModel(requestedModel)) {
    return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedModel };
  }
  if (!isAllowedCodexEffort(requestedEffort)) {
    return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedEffort };
  }
  const codexModel = requestedModel as CodexModel;
  const codexEffort = requestedEffort as CodexEffort;
  const state = taskExecutionState(runtime);
  if (!state) {
    return { ok: false, statusCode: 503, code: 'task_execution_state_unavailable', error: 'Replicated task execution state is unavailable.' };
  }
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const existing = normalized.store.runs.find((run) => run.queuedAfterExecutionId === executionId);
  if (existing) {
    if (!sameQueuedRequest({ run: existing, skillName, codexModel, codexEffort })) {
      return {
        ok: false,
        statusCode: 409,
        code: 'dynamic_skill_already_queued',
        error: 'This execution already queued a different successor skill.',
        pipelineRunId: existing.id,
      };
    }
    return { ok: true, statusCode: 202, idempotent: true, run: existing };
  }
  const currentExecution = state.executions.find(executionId);
  if (!currentExecution) {
    return { ok: false, statusCode: 404, code: 'task_execution_not_found', error: 'Calling execution was not found.', executionId };
  }
  if (currentExecution.lifecycle.phase !== 'running') {
    return {
      ok: false,
      statusCode: 409,
      code: 'task_execution_not_running',
      error: 'Only a running skill can queue its successor.',
      phase: currentExecution.lifecycle.phase,
    };
  }
  if (currentExecution.metadata.kind !== 'pipeline-skill' || !currentExecution.metadata.pipelineRunId) {
    return { ok: false, statusCode: 409, code: 'dynamic_skill_caller_invalid', error: 'Calling execution is not a pipeline skill.' };
  }
  const currentRun = normalized.store.runs.find((run) => run.id === currentExecution.metadata.pipelineRunId);
  const current = currentRun ? runMember(currentRun, executionId) : null;
  if (!currentRun || !current) {
    return { ok: false, statusCode: 409, code: 'dynamic_skill_manifest_missing', error: 'Calling execution has no immutable pipeline manifest.' };
  }
  if (!envelope.admissionLocked) {
    return withCardCodexAdmission(
      {
        decisionOsRoot,
        ledgerId: currentRun.ledgerId,
        cardId: currentRun.sourceCardId,
      },
      () => queueCodexSkillAfterExecutionController({
        action_payload: payload,
        runtime_state: runtime,
        admissionLocked: true,
      }),
    );
  }
  const available = availablePipelineContent({ decisionOsRoot, runtime });
  const selectedContentKind = available.kinds.get(skillName);
  if (!selectedContentKind) {
    return { ok: false, statusCode: 404, code: 'dynamic_skill_not_found', error: 'Selected skill was not found.', skillName };
  }
  const callerContentKind = current.skill.contentKind;
  if (!callerContentKind) {
    return { ok: false, statusCode: 409, code: 'dynamic_skill_caller_kind_missing', error: 'Calling skill has no admitted content kind.' };
  }
  const promptSnapshotOverrides = new Map<string, AdmittedPipelinePromptSnapshot>();
  if (callerContentKind === 'pipeline-prompt') {
    assertPipelinePromptRunSkillSnapshot(current.skill);
    promptSnapshotOverrides.set(current.skill.skillName, {
      contentKind: 'pipeline-prompt',
      contentRevision: current.skill.contentRevision,
      contentCommit: current.skill.contentCommit,
      promptSnapshot: current.skill.promptSnapshot,
    });
  }
  const now = new Date().toISOString();
  const selectedSkill = {
    id: `dynamic-work-${executionId}`,
    skillName,
    contentKind: selectedContentKind,
    codexModel,
    codexEffort,
  };
  const returningCaller = {
    id: `dynamic-caller-${executionId}`,
    skillName: current.skill.skillName,
    contentKind: callerContentKind as CodexContentKind,
    codexModel: current.skill.codexModel as CodexModel,
    codexEffort: current.skill.codexEffort as CodexEffort,
  };
  return startPipelineRun({
    decisionOsRoot,
    runtime,
    admissionLocked: true,
    ledgerId: currentRun.ledgerId,
    sourceCardId: currentRun.sourceCardId,
    onLedgerChange: payload.onLedgerChange,
    queuedAfterExecutionId: executionId,
    initialInputCardId: current.step.outputCardId,
    requestIdPrefix: `dynamic:${executionId}`,
    promptSnapshotOverrides,
    definition: {
      pipelineId: null,
      pipelineName: `Dynamic ${skillName} then ${current.skill.skillName}`,
      temporary: true,
      steps: [
        {
          id: `dynamic-work-step-${executionId}`,
          name: skillName,
          purpose: `Run ${skillName} with the calling gate result.`,
          skills: [selectedSkill],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `dynamic-return-step-${executionId}`,
          name: current.skill.skillName,
          purpose: `Return to ${current.skill.skillName} in a fresh context.`,
          skills: [returningCaller],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  });
}
