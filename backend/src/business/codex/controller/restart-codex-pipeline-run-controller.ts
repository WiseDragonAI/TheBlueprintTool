/**
 * WHAT: Clears generated output and relaunches a terminal pipeline from its persisted option snapshot.
 * WHY: Restart must be deterministic, remove prior card/thread results, and retain resolved run settings.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import {
  resolvePipelineLedgerContext,
} from '../helper/codex-pipeline-runner.js';
import { scheduleCodexProcesses } from '../helper/codex-process-scheduler.js';
import { readCodexPipelineRunController } from './read-codex-pipeline-run-controller.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resetRun(run: CodexPipelineRun, timestamp: string): CodexPipelineRun {
  return {
    ...run,
    createdAt: timestamp,
    status: 'pending',
    steps: run.steps.map((step) => ({
      ...step,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: '',
      skills: step.skills.map((skill) => ({
        ...skill,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        error: '',
      })),
    })),
    updatedAt: timestamp,
    startedAt: null,
    finishedAt: null,
    resumedAt: timestamp,
    error: '',
  };
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
  const normalized = readCodexPipelineStore({ decisionOsRoot });
  const run = normalized.store.runs.find((entry) => entry.id === runId);
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId };
  if (run.status !== 'complete' && run.status !== 'failed' && run.status !== 'cancelled') {
    return { ok: false, statusCode: 409, error: 'Only a terminal pipeline run can be restarted.', runId, status: run.status };
  }
  const context = resolvePipelineLedgerContext({ decisionOsRoot, runtime, ledgerId: run.ledgerId });
  if (!context) return { ok: false, statusCode: 404, error: 'Pipeline ledger not found.', ledgerId: run.ledgerId };
  for (const step of run.steps) {
    const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === step.outputCardId);
    const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    const outputFile = resolveCardContentFile(decisionOsRoot, comment.contentFile);
    if (outputFile) writeFileSync(outputFile, '', 'utf8');
    writeThreadNotesFile({
      decisionOsRoot,
      ledger: context.ledger,
      ledgerPath: context.ledgerPath,
      threadId: `thread-${step.outputCardId}`,
      notes: [],
    });
    for (const skill of step.skills) {
      for (const file of [skill.stdoutFile, skill.stderrFile]) {
        if (!file) continue;
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, '', 'utf8');
      }
      const runtimeRuns = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
        ? runtime.codexSkillRuns as Record<string, AnyRecord>
        : {};
      delete runtimeRuns[skill.runId];
    }
  }
  stripHydratedThreadNotes(context.ledger);
  persistLedgerProjection({ decisionOsRoot, ledgerId: context.ledgerId, ledgerPath: context.ledgerPath, ledger: context.ledger, runtime });
  const restarted = resetRun(run, new Date().toISOString());
  writeCodexPipelineStore({
    decisionOsRoot,
    store: {
      ...normalized.store,
      runs: normalized.store.runs.map((entry) => entry.id === run.id ? restarted : entry),
    },
  });
  if (typeof runtime.onPipelineLedgerChange === 'function') {
    (runtime.onPipelineLedgerChange as (event: AnyRecord) => void)({
      reason: 'pipeline-restarted',
      ledgerId: run.ledgerId,
      pipelineRunId: run.id,
      cardIds: run.steps.map((step) => step.outputCardId),
    });
  }
  const sharedSchedule = runtime.scheduleCodexProcesses;
  if (typeof sharedSchedule === 'function') await sharedSchedule();
  else await scheduleCodexProcesses({ decisionOsRoot, runtime });
  const detail = await readCodexPipelineRunController({ action_payload: { runId: run.id }, runtime_state: runtime });
  return { ...detail, statusCode: 202 };
}
