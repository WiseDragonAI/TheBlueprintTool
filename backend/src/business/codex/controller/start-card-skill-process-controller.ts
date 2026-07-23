/**
 * WHAT: Preserves the direct single-skill API by creating a temporary one-step pipeline run.
 * WHY: Direct and saved workflows must share durable lifecycle, locking, defaults, logs, and resume behavior.
 */
import { resolve } from 'node:path';
import { isAllowedCodexEffort, isAllowedCodexModel } from '../helper/resolve-codex-command.js';
import { outputFileForPipelineCard, resolvePipelineLedgerContext } from '../helper/codex-pipeline-runner.js';
import { startTemporaryPipelineRun } from './start-codex-pipeline-run-controller.js';

type AnyRecord = Record<string, unknown>;

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function startCardSkillProcessController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = optionalText(payload.ledgerId);
  const cardId = optionalText(payload.cardId ?? payload.sourceCardId);
  const skillName = optionalText(payload.skillName);
  // WHAT: Require the direct-run identity before creating its temporary pipeline.
  // WHY: The shared start lifecycle cannot infer a ledger, source card, or skill.
  if (!ledgerId || !cardId || !skillName) {
    return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or skillName.' };
  }
  const codexModel = optionalText(payload.codexModel);
  const codexEffort = optionalText(payload.codexEffort);
  // WHAT: Reject explicit options outside the shared Codex catalog.
  // WHY: Temporary manifests must contain executable immutable option snapshots.
  if (codexModel && !isAllowedCodexModel(codexModel)) {
    return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel };
  }
  if (codexEffort && !isAllowedCodexEffort(codexEffort)) {
    return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort };
  }
  const explicitCodexModel = isAllowedCodexModel(codexModel) ? codexModel : null;
  const explicitCodexEffort = isAllowedCodexEffort(codexEffort) ? codexEffort : null;
  const result = await startTemporaryPipelineRun({
    decisionOsRoot,
    runtime,
    ledgerId,
    sourceCardId: cardId,
    skillName,
    codexModel: explicitCodexModel,
    codexEffort: explicitCodexEffort,
    onLedgerChange: payload.onLedgerChange,
    reservedRunId: optionalText(payload.reservedRunId),
    reservedFirstExecutionId: optionalText(payload.executionId),
    requestIdPrefix: optionalText(payload.requestId),
  });
  // WHAT: Preserve the shared pipeline start error for direct-run callers.
  // WHY: Compatibility fields are valid only after a skill run has been created.
  if (result.ok === false) return result;
  const pipelineRun = result.run && typeof result.run === 'object' ? result.run as AnyRecord : {};
  const firstStep = Array.isArray(pipelineRun.steps) ? pipelineRun.steps[0] as AnyRecord | undefined : undefined;
  const firstSkill = Array.isArray(firstStep?.skills) ? firstStep.skills[0] as AnyRecord | undefined : undefined;
  const context = resolvePipelineLedgerContext({ decisionOsRoot, runtime, ledgerId });
  const outputFile = context && firstStep?.outputCardId
    ? outputFileForPipelineCard(context, decisionOsRoot, String(firstStep.outputCardId))
    : '';
  const compatibilityRun = result.skillRun && typeof result.skillRun === 'object'
    ? result.skillRun as AnyRecord
    : {
        id: firstSkill?.runId ?? pipelineRun.id,
        executionId: firstSkill?.executionId,
        pipelineRunId: pipelineRun.id,
        pipelineId: null,
        pipelineName: pipelineRun.pipelineName,
        pipelineStepId: firstStep?.stepId,
        pipelineStepName: firstStep?.name,
        skillName,
        ledgerId,
        sourceCardId: cardId,
        sourceCardTitle: pipelineRun.sourceCardTitle,
        outputCardId: firstStep?.outputCardId,
        outputFile,
        stdoutFile: firstSkill?.stdoutFile,
        stderrFile: firstSkill?.stderrFile,
        codexModel: firstSkill?.codexModel,
        codexEffort: firstSkill?.codexEffort,
        status: firstSkill?.status,
        startedAt: firstSkill?.startedAt,
      };
  return { ok: true, statusCode: 202, run: compatibilityRun, pipelineRun, queuePosition: result.queuePosition ?? null };
}
