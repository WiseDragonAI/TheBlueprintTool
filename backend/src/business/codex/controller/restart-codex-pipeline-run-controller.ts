/**
 * WHAT: Creates a linked replacement for one terminal saved pipeline run.
 * WHY: Restart must preserve prior execution records, cards, logs, and artifact paths as immutable history.
 */
import { resolve } from 'node:path';
import type { CodexPipelineStep } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { reassessPipelineAfterSkill } from '../helper/codex-pipeline-runner.js';
import { startPipelineRun } from './start-codex-pipeline-run-controller.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function restartCodexPipelineRunController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const runId = text(payload.runId ?? payload.pipelineRunId);
  if (!runId) return { ok: false, statusCode: 400, error: 'Missing pipeline run id.' };
  const stored = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === runId);
  if (!stored) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  if (stored.temporary) {
    return { ok: false, statusCode: 409, error: 'Temporary skill runs cannot be restarted as saved pipelines.', runId };
  }
  const run = reassessPipelineAfterSkill({
    decisionOsRoot,
    runtime,
    pipelineRunId: stored.id,
  }) ?? stored;
  if (run.status !== 'complete' && run.status !== 'failed' && run.status !== 'cancelled') {
    return { ok: false, statusCode: 409, error: 'Only a terminal pipeline run can be restarted.', runId, status: run.status };
  }
  const timestamp = new Date().toISOString();
  const steps: CodexPipelineStep[] = run.steps.map((step) => ({
    id: step.stepId,
    name: step.name,
    purpose: step.purpose,
    createdAt: timestamp,
    updatedAt: timestamp,
    skills: step.skills.map((skill) => ({
      id: skill.pipelineSkillId,
      skillName: skill.skillName,
      codexModel: skill.codexModel as CodexPipelineStep['skills'][number]['codexModel'],
      codexEffort: skill.codexEffort as CodexPipelineStep['skills'][number]['codexEffort'],
    })),
  }));
  const replacement = await startPipelineRun({
    decisionOsRoot,
    runtime,
    ledgerId: run.ledgerId,
    sourceCardId: run.sourceCardId,
    definition: {
      pipelineId: run.pipelineId,
      pipelineName: run.pipelineName,
      temporary: false,
      executionMode: run.executionMode,
      steps,
    },
    restartOfRun: run,
    onLedgerChange: runtime.onPipelineLedgerChange,
    plannedExecutors: run.executionMode === 'federated'
      ? run.steps.flatMap((step) => step.skills.map((skill) => skill.executor)).filter(
        (executor): executor is NonNullable<typeof executor> => Boolean(executor),
      )
      : undefined,
  });
  return {
    ...replacement,
    statusCode: replacement.ok === false ? replacement.statusCode : 202,
    restartOfPipelineRunId: run.id,
  };
}
