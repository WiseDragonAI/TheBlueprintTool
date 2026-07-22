/**
 * WHAT: Returns one durable pipeline run with step, skill, card, option, log, and error detail.
 * WHY: Pipeline UI state must be reconstructible without process-local child metadata.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import {
  pipelineRunLogAvailability,
  reassessPipelineAfterSkill,
  resolvePipelineLedgerContext,
} from '../helper/codex-pipeline-runner.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { codexExecutionCoordinator } from '../helper/codex-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function readCodexPipelineRunController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const runId = text(payload.runId ?? payload.pipelineRunId);
  if (!runId) return { ok: false, statusCode: 400, error: 'Missing pipeline run id.' };
  const storedStore = readCodexPipelineStore({ decisionOsRoot }).store;
  const storedRun = storedStore.runs.find((entry) => entry.id === runId);
  const run = storedRun && (storedRun.status === 'pending' || storedRun.status === 'running')
    ? reassessPipelineAfterSkill({ decisionOsRoot, runtime, pipelineRunId: runId }) ?? storedRun
    : storedRun;
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  const context = resolvePipelineLedgerContext({ decisionOsRoot, runtime, ledgerId: run.ledgerId });
  const cardsById = new Map((context?.ledger.cards ?? []).map((card) => [String(card.id ?? ''), card]));
  const steps = run.steps.map((step) => {
    const card = cardsById.get(step.outputCardId);
    const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    const contentFile = resolveCardContentFile(decisionOsRoot, comment.contentFile) ?? '';
    return {
      ...step,
      outputCard: {
        id: step.outputCardId,
        title: text(card?.title) || step.name,
        contentAvailable: Boolean(contentFile && existsSync(contentFile)),
        contentBytes: contentFile && existsSync(contentFile) ? readFileSync(contentFile).byteLength : 0,
      },
      skills: step.skills.map((skill) => ({
        ...skill,
        ...pipelineRunLogAvailability(skill),
      })),
    };
  });
  const activeStep = steps.find((step) => step.status === 'running' || step.status === 'pending') ?? null;
  const activeSkill = activeStep?.skills.find((skill) => skill.status === 'running' || skill.status === 'pending') ?? null;
  const latestSkill = activeSkill ?? steps.flatMap((step) => step.skills).at(-1) ?? null;
  const execution = latestSkill ? codexExecutionCoordinator(runtime)?.dto(latestSkill.executionId) ?? null : null;
  const pipeline = run.pipelineId
    ? readCodexPipelineStore({ decisionOsRoot }).store.pipelines.find((entry) => entry.id === run.pipelineId) ?? null
    : null;
  const terminal = run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled';
  return {
    ok: true,
    statusCode: 200,
    run: { ...run, steps },
    pipeline,
    activeStep,
    activeSkill,
    execution,
    canCancel: execution ? execution.validActions.includes('cancel') : run.status === 'pending' || run.status === 'running',
    canRestart: terminal,
    canContinue: terminal,
    queuePosition: run.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot, id: run.id, createdAt: run.createdAt, runtime }) : null,
  };
}
