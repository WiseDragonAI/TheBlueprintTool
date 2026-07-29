/**
 * WHAT: Deletes the Codex run owned by one card thread after any live child has settled.
 * WHY: Clearing the run association must make the next thread launch a genuinely fresh session.
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';
import { hasLedgerProjectionSource, readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';
import { resolveCardSkillRunFiles } from '../helper/resolve-card-skill-run-files.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
}

function retainedThreadRunIds(card: AnyRecord): string[] {
  const retained = Array.isArray(card.codexThreadRunIds)
    ? card.codexThreadRunIds.map(String).map((runId) => runId.trim()).filter(Boolean)
    : [];
  const current = String(card.codexThreadRunId ?? '').trim();
  return [...new Set([...retained, current].filter(Boolean))];
}

export async function deleteThreadCodexSessionController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };
  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !hasLedgerProjectionSource({ ledgerId, ledgerPath, runtime })) {
    return { ok: false, statusCode: 404, error: 'Ledger source not found.', ledgerId };
  }

  const ledger = readLedgerProjection({ ledgerId, ledgerPath, runtime }) as AnyRecord & { cards?: AnyRecord[] };
  const ledgerText = JSON.stringify(ledger);
  const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!card) return { ok: false, statusCode: 404, error: 'Card not found.', cardId };
  const ownedRunIds = retainedThreadRunIds(card);
  const replicatedState = taskExecutionState(runtime);
  const replicatedExecutions = replicatedState?.executions.bySessionId(runId) ?? [];
  const canonicalOwnership = replicatedExecutions.length > 0 && replicatedExecutions.every((execution) => (
    execution.metadata.ledgerId === ledgerId
    && (execution.metadata.sourceCardId === cardId || execution.metadata.ownerCardId === cardId)
  ));
  if (!ownedRunIds.includes(runId) && !canonicalOwnership) {
    return { ok: false, statusCode: 404, error: 'Thread Codex session not found on card.', cardId, runId };
  }
  if (replicatedExecutions.length > 0 && !canonicalOwnership) {
    return { ok: false, statusCode: 409, error: 'Thread Codex session belongs to another card.', cardId, runId };
  }
  if (replicatedExecutions.some((execution) => (
    execution.lifecycle.phase === 'preparing'
    || execution.lifecycle.phase === 'queued'
    || execution.lifecycle.phase === 'starting'
    || execution.lifecycle.phase === 'running'
    || execution.lifecycle.phase === 'cancelling'
  ))) {
    return { ok: false, statusCode: 409, error: 'Codex execution session is still active.', runId };
  }

  const outputFiles = card.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
    ? card.codexThreadRunOutputFiles as Record<string, unknown>
    : {};
  const runFiles = resolveCardSkillRunFiles({ ledger, decisionOsRoot, ledgerPath, cardId, runId });
  const runDirectory = runFiles.runDirectory;
  if (!isInside(decisionOsRoot, runDirectory)) return { ok: false, statusCode: 400, error: 'Codex run directory is outside the workspace.', runId };
  const artifactFiles = [runFiles.stdoutFile, runFiles.stderrFile, runFiles.outputFile, `${runFiles.stdoutFile}.telemetry.jsonl`];
  if (artifactFiles.some((file) => !isInside(runDirectory, file))) return { ok: false, statusCode: 400, error: 'Codex run artifact is outside its run directory.', runId };
  try {
    if (replicatedExecutions.length > 0) await replicatedState!.executions.deleteSession(runId);
    const remainingRunIds = ownedRunIds.filter((ownedRunId) => ownedRunId !== runId);
    const remainingOutputFiles = Object.fromEntries(Object.entries(outputFiles).filter(([ownedRunId]) => ownedRunId !== runId));
    if (Object.keys(remainingOutputFiles).length > 0) card.codexThreadRunOutputFiles = remainingOutputFiles;
    else delete card.codexThreadRunOutputFiles;
    if (remainingRunIds.length > 0) card.codexThreadRunIds = remainingRunIds;
    else delete card.codexThreadRunIds;
    if (String(card.codexThreadRunId ?? '') === runId) {
      const promotedRunId = remainingRunIds.at(-1) ?? '';
      if (promotedRunId) {
        card.codexThreadRunId = promotedRunId;
        const discoveredOutputFile = resolveCardSkillRunFiles({ ledger, decisionOsRoot, ledgerPath, cardId, runId: promotedRunId }).outputFile;
        const promotedOutputFile = String(remainingOutputFiles[promotedRunId] ?? '').trim()
          || (existsSync(discoveredOutputFile) ? relative(dirname(decisionOsRoot), discoveredOutputFile) : '');
        // WHAT: Persist legacy artifact discovery when promoting a retained session.
        // WHY: A moved card must keep the promoted run's real artifact directory instead of deriving it from its current ledger.
        if (promotedOutputFile) remainingOutputFiles[promotedRunId] = promotedOutputFile;
        if (Object.keys(remainingOutputFiles).length > 0) card.codexThreadRunOutputFiles = remainingOutputFiles;
        if (promotedOutputFile) card.codexThreadRunOutputFile = promotedOutputFile;
        else delete card.codexThreadRunOutputFile;
      } else {
        delete card.codexThreadRunId;
        delete card.codexThreadRunOutputFile;
      }
    }
    stripHydratedThreadNotes(ledger);
    await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger, runtime, command: { kind: 'delete-codex-session', cardIds: [cardId] } });
  } catch (error) {
    try {
      await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger: JSON.parse(ledgerText) as AnyRecord, runtime, command: { kind: 'restore-codex-session', cardIds: [cardId] } });
    } catch {
      return { ok: false, statusCode: 500, error: 'Codex session deletion failed and rollback could not restore every artifact.', runId };
    }
    return { ok: false, statusCode: 500, error: error instanceof Error ? error.message : 'Codex session deletion failed.', runId };
  }

  delete runtimeRuns(runtime)[runId];
  const onLedgerChange = payload.onLedgerChange;
  if (typeof onLedgerChange === 'function') onLedgerChange({ ledgerId, cardId, runId, source: 'delete-thread-codex-session' });
  return {
    ok: true,
    statusCode: 200,
    ledgerId,
    cardId,
    runId,
    status: 'deleted',
    artifactsRetained: true,
    executionCount: replicatedExecutions.length,
  };
}
