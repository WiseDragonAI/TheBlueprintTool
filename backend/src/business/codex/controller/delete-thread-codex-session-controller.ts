/**
 * WHAT: Deletes the Codex run owned by one card thread after any live child has settled.
 * WHY: Clearing the run association must make the next thread launch a genuinely fresh session.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { cancelCardSkillRunController } from './cancel-card-skill-run-controller.js';

type AnyRecord = Record<string, unknown>;
type ArtifactSnapshot = { file: string; content: Buffer };

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
}

async function waitForSettlement(runtime: AnyRecord, runId: string, timeoutMs = 10000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = runtimeRuns(runtime)[runId];
    if (!run || String(run.settledAt ?? '').trim()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  return false;
}

function restoreArtifacts(snapshots: ArtifactSnapshot[]): void {
  for (const snapshot of snapshots) writeFileSync(snapshot.file, snapshot.content);
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
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledgerText = readFileSync(ledgerPath, 'utf8');
  const ledger = JSON.parse(ledgerText) as AnyRecord & { cards?: AnyRecord[] };
  const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!card) return { ok: false, statusCode: 404, error: 'Card not found.', cardId };
  const ownedRunIds = retainedThreadRunIds(card);
  if (!ownedRunIds.includes(runId)) {
    return { ok: false, statusCode: 404, error: 'Thread Codex session not found on card.', cardId, runId };
  }

  const run = runtimeRuns(runtime)[runId];
  if (run && String(run.status ?? '') === 'running') {
    const cancelled = await cancelCardSkillRunController({ action_payload: { ledgerId, cardId, runId }, runtime_state: runtime });
    if (cancelled.ok === false) return cancelled;
  }
  if (run && !String(run.settledAt ?? '').trim() && !await waitForSettlement(runtime, runId)) {
    return { ok: false, statusCode: 504, error: 'Codex run did not settle before session deletion.', runId };
  }

  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
  if (!isInside(decisionOsRoot, runDirectory)) return { ok: false, statusCode: 400, error: 'Codex run directory is outside the workspace.', runId };
  const runBase = resolve(runDirectory, safeSegment(runId));
  const artifactFiles = [`${runBase}.jsonl`, `${runBase}.log`, `${runBase}.md`, `${runBase}.jsonl.telemetry.jsonl`];
  if (artifactFiles.some((file) => !isInside(runDirectory, file))) return { ok: false, statusCode: 400, error: 'Codex run artifact is outside its run directory.', runId };
  let snapshots: ArtifactSnapshot[];
  try {
    snapshots = artifactFiles.filter(existsSync).map((file) => ({ file, content: readFileSync(file) }));
  } catch (error) {
    return { ok: false, statusCode: 500, error: error instanceof Error ? error.message : 'Codex session artifacts could not be read.', runId };
  }

  try {
    for (const snapshot of snapshots) rmSync(snapshot.file);
    if (String(card.codexActiveRunId ?? '') === runId) {
      delete card.codexActiveRunId;
      delete card.codexActiveExecutionId;
      if (String(card.executionRunId ?? '') === runId) {
        delete card.executionRunId;
        delete card.executionStatus;
      }
    }
    const remainingRunIds = ownedRunIds.filter((ownedRunId) => ownedRunId !== runId);
    if (remainingRunIds.length > 0) card.codexThreadRunIds = remainingRunIds;
    else delete card.codexThreadRunIds;
    if (String(card.codexThreadRunId ?? '') === runId) {
      const promotedRunId = remainingRunIds.at(-1) ?? '';
      if (promotedRunId) {
        card.codexThreadRunId = promotedRunId;
        card.codexThreadRunOutputFile = `.decision-os/runs/codex-skills/${safeSegment(ledgerStem(ledgerPath))}/${safeSegment(promotedRunId)}.md`;
      } else {
        delete card.codexThreadRunId;
        delete card.codexThreadRunOutputFile;
      }
    }
    stripHydratedThreadNotes(ledger);
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  } catch (error) {
    try {
      writeFileSync(ledgerPath, ledgerText, 'utf8');
      restoreArtifacts(snapshots);
    } catch {
      return { ok: false, statusCode: 500, error: 'Codex session deletion failed and rollback could not restore every artifact.', runId };
    }
    return { ok: false, statusCode: 500, error: error instanceof Error ? error.message : 'Codex session deletion failed.', runId };
  }

  delete runtimeRuns(runtime)[runId];
  const onLedgerChange = payload.onLedgerChange;
  if (typeof onLedgerChange === 'function') onLedgerChange({ ledgerId, cardId, runId, source: 'delete-thread-codex-session' });
  return { ok: true, statusCode: 200, ledgerId, cardId, runId, status: 'deleted' };
}
