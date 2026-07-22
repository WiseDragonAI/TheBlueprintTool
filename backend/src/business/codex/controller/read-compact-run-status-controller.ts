/**
 * WHAT: Returns lifecycle-only skill and pipeline run projections without reading JSONL run histories.
 * WHY: Control Room classification needs current status, timestamps, and queue position, not events or diagnostics.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';
import { readLedgerProjection } from '../../task-state/helper/read-ledger-projection.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { readCodexProcessQueue } from '../helper/codex-process-queue.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { legacyCodexExecutionStatus } from '../helper/codex-execution-coordinator.js';
import { codexExecutionCoordinator } from '../helper/codex-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function runtimeRun(runtime: AnyRecord, runId: string): AnyRecord {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  return runs[runId] ?? {};
}

function normalizedStatus(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  if (status === 'complete' || status === 'completed' || status === 'succeeded') return 'complete';
  if (status === 'failure' || status === 'error') return 'failed';
  if (status === 'canceled') return 'cancelled';
  if (['pending', 'running', 'processing', 'in_progress', 'failed', 'cancelled', 'stale'].includes(status)) return status;
  return 'unknown';
}

function elapsedMs(startedAt: unknown, finishedAt: unknown): number | null {
  const started = Date.parse(String(startedAt ?? ''));
  if (!Number.isFinite(started)) return null;
  const finished = Date.parse(String(finishedAt ?? ''));
  return Math.max(0, (Number.isFinite(finished) ? finished : Date.now()) - started);
}

export function readCompactSkillRunStatusController(input: { runId: string; ledgerId: string; cardId: string; runtime: AnyRecord }): AnyRecord {
  const { runId, ledgerId, cardId, runtime } = input;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  if (!runId || !ledgerId || !cardId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };
  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const ledgerEntry = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!ledgerEntry) return { ok: false, statusCode: 404, error: 'Ledger not found.' };
  const ledgerPath = resolve(decisionOsRoot, String(ledgerEntry.ledgerFile ?? '').replace(/^\.decision-os\//, ''));
  if (!existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.' };
  const ledger = readLedgerProjection({ ledgerId, ledgerPath, runtime });
  const ownership = resolveCardSkillRunOwnership({ ledger, decisionOsRoot, cardId, runId });
  if (!ownership.found) return { ok: false, statusCode: 404, error: 'Run not found on card.' };
  const canonical = codexExecutionCoordinator(runtime)?.dtoForSession(runId, cardId) ?? null;
  if (canonical) {
    const status = legacyCodexExecutionStatus(canonical.phase);
    return {
      ok: true,
      statusCode: 200,
      runId,
      kind: 'skill',
      ledgerId,
      cardId,
      status,
      phase: canonical.phase,
      active: canonical.live,
      startedAt: canonical.startedAt ?? '',
      finishedAt: canonical.finishedAt ?? '',
      elapsedMs: elapsedMs(canonical.startedAt ?? canonical.requestedAt, canonical.finishedAt),
      error: canonical.error?.message ?? '',
      lifecycleRevision: canonical.revision,
      queuePosition: null,
      pipelineRunId: canonical.pipelineRunId,
      execution: canonical,
    };
  }
  const live = runtimeRun(runtime, runId);
  const pipelineRun = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.steps.some((step) => step.skills.some((skill) => skill.runId === runId)));
  const persistedSkill = pipelineRun?.steps.flatMap((step) => step.skills).find((skill) => skill.runId === runId);
  const queued = readCodexProcessQueue(decisionOsRoot).find((item) => item.id === runId || String(item.payload.runId ?? '') === runId);
  const status = normalizedStatus(live.status ?? persistedSkill?.status ?? (queued ? 'pending' : 'unknown'));
  const startedAt = String(live.startedAt ?? persistedSkill?.startedAt ?? '');
  const finishedAt = String(live.finishedAt ?? persistedSkill?.finishedAt ?? '');
  return {
    ok: true,
    statusCode: 200,
    runId,
    kind: 'skill',
    ledgerId,
    cardId,
    status,
    active: status === 'running' || status === 'processing' || status === 'in_progress',
    startedAt,
    finishedAt,
    elapsedMs: elapsedMs(startedAt, finishedAt),
    error: status === 'failed' ? String(live.error ?? persistedSkill?.error ?? '') : '',
    lifecycleRevision: Number(live.revision ?? (persistedSkill as unknown as AnyRecord | undefined)?.revision ?? 0),
    queuePosition: status === 'pending' && queued
      ? unifiedCodexQueuePosition({ decisionOsRoot, id: queued.id, createdAt: queued.createdAt, runtime })
      : null,
    pipelineRunId: pipelineRun?.id ?? null,
  };
}

export function readCompactPipelineRunStatusController(input: { runId: string; runtime: AnyRecord }): AnyRecord {
  const decisionOsRoot = resolve(String(input.runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === input.runId);
  if (!run) return { ok: false, statusCode: 404, error: 'Pipeline run not found.' };
  const activeStep = run.steps.find((step) => step.status === 'running' || step.status === 'pending') ?? null;
  const activeSkill = activeStep?.skills.find((skill) => skill.status === 'running' || skill.status === 'pending') ?? null;
  const latestSkill = activeSkill ?? run.steps.flatMap((step) => step.skills).at(-1) ?? null;
  const canonical = latestSkill ? codexExecutionCoordinator(input.runtime)?.dto(latestSkill.executionId) ?? null : null;
  if (canonical) {
    const status = legacyCodexExecutionStatus(canonical.phase);
    return {
      ok: true,
      statusCode: 200,
      runId: run.id,
      kind: 'pipeline',
      ledgerId: run.ledgerId,
      cardId: canonical.ownerCardId,
      status,
      phase: canonical.phase,
      active: canonical.live,
      startedAt: canonical.startedAt ?? '',
      finishedAt: canonical.finishedAt ?? '',
      elapsedMs: elapsedMs(canonical.startedAt ?? canonical.requestedAt, canonical.finishedAt),
      error: canonical.error?.message ?? '',
      lifecycleRevision: canonical.revision,
      queuePosition: null,
      execution: canonical,
    };
  }
  const status = normalizedStatus(run.status);
  const startedAt = activeSkill?.startedAt ?? activeStep?.startedAt ?? run.resumedAt ?? run.startedAt ?? '';
  const finishedAt = run.finishedAt ?? '';
  return {
    ok: true,
    statusCode: 200,
    runId: run.id,
    kind: 'pipeline',
    ledgerId: run.ledgerId,
    cardId: activeStep?.outputCardId ?? run.sourceCardId,
    status,
    active: status === 'running' || status === 'processing' || status === 'in_progress',
    startedAt,
    finishedAt,
    elapsedMs: elapsedMs(startedAt, finishedAt),
    error: status === 'failed' ? String(run.error ?? '') : '',
    lifecycleRevision: Number((run as unknown as AnyRecord).revision ?? 0),
    queuePosition: status === 'pending'
      ? unifiedCodexQueuePosition({ decisionOsRoot, id: run.id, createdAt: run.createdAt, runtime: input.runtime })
      : null,
  };
}
