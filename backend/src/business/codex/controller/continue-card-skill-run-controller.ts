/**
 * WHAT: Resumes an existing card-scoped Codex skill run with newer thread messages.
 * WHY: Operators need to continue the original Codex session from the output card widget.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { hydrateLedgerCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { hydrateLedgerThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { buildCardSkillContinuePrompt } from '../helper/build-card-skill-continue-prompt.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexResumeCommand } from '../helper/resolve-codex-command.js';
import { readCardSkillRunController } from './read-card-skill-run-controller.js';

type AnyRecord = Record<string, unknown>;
type ProcessStatus = 'running' | 'complete' | 'failed' | 'cancelled';

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function workspaceRootForDecisionOsRoot(decisionOsRoot: string): string {
  return dirname(decisionOsRoot);
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
}

function runtimeRunStatus(runtime: AnyRecord, runId: string): string {
  return String(runtimeRuns(runtime)[runId]?.status ?? '');
}

function updateRuntimeRun(runtime: AnyRecord, runId: string, patch: AnyRecord): void {
  const runs = runtimeRuns(runtime);
  runs[runId] = { ...(runs[runId] ?? {}), ...patch };
}

function attachRuntimeRunChild(runtime: AnyRecord, runId: string, child: ChildProcess): void {
  const run = runtimeRuns(runtime)[runId];
  if (!run) return;
  Object.defineProperty(run, 'child', { value: child, writable: true, configurable: true, enumerable: false });
}

function notifyLedgerChange(callback: unknown, event: AnyRecord): void {
  if (typeof callback === 'function') callback(event);
}

function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
  try {
    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
  } catch {
    // The JSONL and stderr log remain the fallback status records.
  }
}

function finishRunStreams(stdout: WriteStream, stderr: WriteStream, callback: () => void): void {
  let pending = 2;
  const done = (): void => {
    pending -= 1;
    if (pending === 0) callback();
  };
  for (const stream of [stdout, stderr]) {
    if (stream.destroyed || stream.writableEnded) done();
    else stream.end(done);
  }
}

function readRunSessionId(stdoutFile: string): string {
  if (!existsSync(stdoutFile)) return '';
  for (const line of readFileSync(stdoutFile, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const nestedPayload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload as AnyRecord : {};
      const sessionId = String(event.thread_id ?? event.session_id ?? nestedPayload.session_id ?? '').trim();
      if (sessionId) return sessionId;
    } catch {
      // Ignore malformed run lines; later valid lines can still identify the session.
    }
  }
  return '';
}

function cardReferencesRun(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string; runId: string }): boolean {
  const hydrated = hydrateLedgerCardContent(JSON.parse(JSON.stringify(input.ledger)), input.decisionOsRoot) as { cards?: AnyRecord[] };
  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) return false;
  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  const body = String(comment.what ?? comment.body ?? comment.description ?? '');
  return body.includes(`Codex run: ${input.runId}`);
}

function outputFileForRunCard(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string }): string {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const card = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return resolveCardContentFile(input.decisionOsRoot, comment.contentFile) ?? '';
}

function threadMessagesAfterLastSessionEnd(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string; runId: string }): AnyRecord[] {
  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
  const threadId = `thread-${input.cardId}`;
  const notes = normalizeLedgerNotes(input.ledger)[threadId] ?? [];
  let sessionEndIndex = -1;
  let sessionEndTime = 0;
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    if (String(note.codexRunId ?? '') !== input.runId || String(note.codexEventType ?? '') !== 'turn.completed') continue;
    const timestamp = Date.parse(String(note.timestamp ?? '')) || 0;
    if (timestamp >= sessionEndTime) {
      sessionEndIndex = index;
      sessionEndTime = timestamp;
    }
  }
  if (sessionEndIndex < 0) {
    for (let index = 0; index < notes.length; index += 1) {
      if (String(notes[index].codexRunId ?? '') !== input.runId) continue;
      const timestamp = Date.parse(String(notes[index].timestamp ?? '')) || 0;
      if (timestamp >= sessionEndTime) {
        sessionEndIndex = index;
        sessionEndTime = timestamp;
      }
    }
  }
  return notes.filter((note, index) => {
    if (!String(note.message ?? note.body ?? '').trim() || index === sessionEndIndex) return false;
    const timestamp = Date.parse(String(note.timestamp ?? '')) || 0;
    if (sessionEndTime > 0 && timestamp > 0) return timestamp > sessionEndTime;
    return index > sessionEndIndex;
  });
}

function publicRun(run: AnyRecord): AnyRecord {
  const { child: _child, ...rest } = run;
  return rest;
}

export async function continueCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };
  if (runtimeRunStatus(runtime, runId) === 'running') return { ok: false, statusCode: 409, error: 'Run is already active.', runId };

  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const sessionId = readRunSessionId(stdoutFile);
  if (!sessionId) return { ok: false, statusCode: 409, error: 'Codex session id was not captured for this run.', runId };

  const status = await readCardSkillRunController({ action_payload: { ledgerId, cardId, runId, since: 0 }, runtime_state: runtime });
  if (status.ok === false) return status;
  if (status.status === 'running') return { ok: false, statusCode: 409, error: 'Run is already active.', runId };

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
  if (!cardReferencesRun({ ledger, decisionOsRoot, cardId, runId })) return { ok: false, statusCode: 404, error: 'Run not found on card.', cardId, runId };
  const messages = threadMessagesAfterLastSessionEnd({ ledger, decisionOsRoot, cardId, runId });
  if (messages.length === 0) return { ok: false, statusCode: 409, error: 'No thread messages were found after the last Codex session end.', runId };

  const outputFile = outputFileForRunCard({ ledger, decisionOsRoot, cardId });
  if (!outputFile) return { ok: false, statusCode: 500, error: 'Run output card content file was not found.', cardId };

  const command = resolveCodexResumeCommand({ workspaceRoot, runtime, sessionId, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
  const prompt = buildCardSkillContinuePrompt({ messages });
  mkdirSync(runDirectory, { recursive: true });
  const child = spawn(command.command, command.args, { cwd: workspaceRoot, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = createWriteStream(stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(stderrFile, { flags: 'a' });
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(prompt);

  const continuedAt = new Date().toISOString();
  const run = {
    id: runId,
    ledgerId,
    outputCardId: cardId,
    outputFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    resumeSessionId: sessionId,
    continuedMessageCount: messages.length,
    pid: child.pid ?? 0,
    status: 'running',
    startedAt: continuedAt,
    continuedAt,
  };
  updateRuntimeRun(runtime, runId, run);
  attachRuntimeRunChild(runtime, runId, child);
  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-continue-started', ledgerId, outputCardId: cardId, runId, continuedMessageCount: messages.length, codexModel: command.model, codexEffort: command.effort });

  let settled = false;
  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    appendRunStatus(outputFile, 'failed', `resume failed: ${error.message}`);
    updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      void readCardSkillRunController({ action_payload: { ledgerId, cardId, runId }, runtime_state: runtime })
        .catch(() => undefined)
        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-continue-failed', ledgerId, outputCardId: cardId, runId }));
    });
  });
  child.on('close', (exitCode) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    const status: ProcessStatus = runtimeRunStatus(runtime, runId) === 'cancelled' ? 'cancelled' : exitCode === 0 ? 'complete' : 'failed';
    const detail = status === 'cancelled' ? 'terminated by operator' : `resume exit code ${exitCode ?? 'unknown'}`;
    appendRunStatus(outputFile, status, detail);
    updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      void readCardSkillRunController({ action_payload: { ledgerId, cardId, runId }, runtime_state: runtime })
        .catch(() => undefined)
        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-skill-continue-cancelled' : 'codex-skill-continue-finished', ledgerId, outputCardId: cardId, runId, exitCode }));
    });
  });

  return { ok: true, statusCode: 202, run: publicRun(run) };
}
