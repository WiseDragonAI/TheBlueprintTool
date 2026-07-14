/**
 * WHAT: Continues an existing card-scoped Codex skill run with newer thread messages.
 * WHY: Operators need to resume the current session or start a fresh session from the output card widget.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { prepareCardSkillRunEventAppend } from '../effect/prepare-card-skill-run-event-append.js';
import { buildCardSkillContinuePrompt } from '../helper/build-card-skill-continue-prompt.js';
import { buildCardLaunchContext } from '../helper/build-card-launch-context.js';
import { codexRunSegmentMarker } from '../helper/codex-run-segment-marker.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand, resolveCodexResumeCommand } from '../helper/resolve-codex-command.js';
import { threadMessagesAfterLastCodexEvent } from '../helper/thread-messages-after-last-codex-event.js';
import { readCardSkillRunController } from './read-card-skill-run-controller.js';
import { decisionOsCodexEnvironment } from '../helper/decision-os-codex-runtime.js';
import { randomUUID } from 'node:crypto';
import { enqueueCodexContinuation, removeCodexProcessQueueItem } from '../helper/codex-process-queue.js';
import { scheduleCodexProcesses, unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { createTerminalCodexProcessReconciler, type TerminalCodexStatus } from '../helper/reconcile-terminal-codex-process.js';
import { clearCardCodexActiveRun } from '../helper/clear-card-codex-active-run.js';

type AnyRecord = Record<string, unknown>;
type ProcessStatus = 'running' | 'complete' | 'failed' | 'cancelled';

function logCodexContinueDebug(phase: string, detail: AnyRecord): void {
  console.log(JSON.stringify({ codexContinueDebug: true, source: 'backend', phase, at: new Date().toISOString(), ...detail }));
}

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

function notifyRunSettled(callback: unknown, event: AnyRecord): void {
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
  let sessionId = '';
  for (const line of readFileSync(stdoutFile, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const nestedPayload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload as AnyRecord : {};
      const capturedSessionId = String(event.thread_id ?? event.session_id ?? nestedPayload.session_id ?? '').trim();
      if (capturedSessionId) sessionId = capturedSessionId;
    } catch {
      // Ignore malformed run lines; later valid lines can still identify the session.
    }
  }
  return sessionId;
}

function outputFileForRunCard(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string }): string {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const card = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  const runOutputFile = String(card?.codexThreadRunOutputFile ?? card?.codexRunOutputFile ?? '').trim();
  if (runOutputFile) {
    const relativePath = runOutputFile.replace(/^\.decision-os\//, '');
    const file = resolve(input.decisionOsRoot, relativePath);
    if (isInside(input.decisionOsRoot, file)) return file;
  }
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return resolveCardContentFile(input.decisionOsRoot, comment.contentFile) ?? '';
}

function runFileLineCount(file: string): number {
  return existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim()).length : 0;
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
  const traceId = String(payload.traceId ?? '');
  const newSession = payload.newSession === true;
  const queueDispatch = payload.queueDispatch === true;
  const queueItemId = optionalText(payload.queueItemId);
  const fail = (statusCode: number, error: string, extra: AnyRecord = {}): AnyRecord => {
    logCodexContinueDebug('continue-controller-fail', { traceId, ledgerId, cardId, runId, statusCode, error, ...extra });
    return { ok: false, statusCode, error, runId, ...extra };
  };
  logCodexContinueDebug('continue-controller-entry', { traceId, ledgerId, cardId, runId, newSession, decisionOsRoot, workspaceRoot, runtimeStatus: runtimeRunStatus(runtime, runId) });
  if (!ledgerId || !cardId || !runId) return fail(400, 'Missing ledgerId, cardId, or runId.');
  if (runtimeRunStatus(runtime, runId) === 'running') return fail(409, 'Run is already active.');

  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return fail(400, 'Unsupported Codex model.', { codexModel: requestedCodexModel });
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return fail(400, 'Unsupported Codex effort.', { codexEffort: requestedCodexEffort });

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return fail(404, 'Ledger not found.', { ledgerId });

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return fail(404, 'Ledger file not found.', { ledgerId, ledgerPath });

  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const sessionId = readRunSessionId(stdoutFile);
  logCodexContinueDebug('run-files-resolved', { traceId, ledgerId, cardId, runId, newSession, runDirectory, stdoutFile, stderrFile, stdoutLineCount: runFileLineCount(stdoutFile), stderrBytes: existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8').length : 0, sessionId });
  if (!newSession && !sessionId) return fail(409, 'Codex session id was not captured for this run.');

  const status = await readCardSkillRunController({ action_payload: { ledgerId, cardId, runId, since: 0, traceId }, runtime_state: runtime });
  logCodexContinueDebug('preflight-status', { traceId, ledgerId, cardId, runId, ok: status.ok, status: status.status, lineCount: status.lineCount, persistedEventCount: status.persistedEventCount, latestEventType: status.latestEvent && typeof status.latestEvent === 'object' ? String((status.latestEvent as AnyRecord).type ?? '') : '', error: status.error });
  if (status.ok === false) return status;
  // A freshly restarted server can infer `running` from recent file writes, but
  // only an in-memory runtime entry proves that this server still owns a child.

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
  if (!resolveCardSkillRunOwnership({ ledger, decisionOsRoot, cardId, runId }).found) {
    return fail(404, 'Run not found on card.', { cardId });
  }
  const continuation = threadMessagesAfterLastCodexEvent({ ledger, decisionOsRoot, cardId, runId, traceId });
  const interrupted = status.status === 'running' || status.status === 'pending' || status.status === 'unknown';
  const messages = continuation.messages.length > 0
    ? continuation.messages
    : interrupted
      ? [{ role: 'operator', message: 'Continue the interrupted task from the durable session context.' }]
      : [];
  logCodexContinueDebug('message-extraction', continuation.debug);
  if (messages.length === 0) return fail(409, 'No thread messages were found after the last Codex session end.');

  const outputFile = outputFileForRunCard({ ledger, decisionOsRoot, cardId });
  if (!outputFile) return fail(500, 'Run output card content file was not found.', { cardId });
  if (newSession && !existsSync(outputFile)) return fail(500, 'Run output card content file was not found.', { cardId, outputFile });
  const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  const statusMetadata = status.metadata && typeof status.metadata === 'object' && !Array.isArray(status.metadata) ? status.metadata as AnyRecord : {};
  const codexModel = requestedCodexModel || optionalText(card?.codexRunModel) || optionalText(statusMetadata.codexModel);
  const codexEffort = requestedCodexEffort || optionalText(card?.codexRunEffort) || optionalText(statusMetadata.codexEffort);

  const command = newSession
    ? resolveCodexCommand({ workspaceRoot, runtime, codexModel, codexEffort })
    : resolveCodexResumeCommand({ workspaceRoot, runtime, sessionId, codexModel, codexEffort });
  if (card) {
    card.codexRunModel = command.model;
    card.codexRunEffort = command.effort;
    stripHydratedThreadNotes(ledger);
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  }
  const prompt = buildCardSkillContinuePrompt({
    messages,
    newSessionContext: newSession ? {
      workspaceRoot,
      ledgerFile: ledgerPath,
      runId,
      cardId,
      cardTitle: String(card?.title ?? cardId),
      outputFile,
      outputMarkdown: readFileSync(outputFile, 'utf8'),
      context: buildCardLaunchContext({
        projectId: String(runtime.projectId ?? ''),
        ledgerId,
        cardId,
        threadId: `thread-${cardId}`,
        ledger,
        cardMarkdown: readFileSync(outputFile, 'utf8'),
        threadMarkdown: messages.map((message) => `# ${String(message.role ?? '').toLowerCase() === 'agent' ? 'AGENT' : 'OPERATOR'}\n\n${String(message.message ?? message.body ?? '')}`).join('\n\n'),
      }),
    } : undefined,
  });
  if (!queueDispatch) {
    const createdAt = new Date().toISOString();
    const itemId = `codex-continuation-${Date.now()}-${randomUUID().slice(0, 8)}`;
    enqueueCodexContinuation({
      decisionOsRoot,
      id: itemId,
      createdAt,
      payload: { ledgerId, cardId, runId, newSession, codexModel: command.model, codexEffort: command.effort, traceId },
    });
    updateRuntimeRun(runtime, runId, {
      id: runId, ledgerId, outputCardId: cardId, codexModel: command.model, codexEffort: command.effort,
      status: 'pending', queueItemId: itemId, createdAt,
    });
    const schedule = runtime.scheduleCodexProcesses;
    if (typeof schedule === 'function') await schedule();
    else await scheduleCodexProcesses({ decisionOsRoot, runtime });
    const current = publicRun(runtimeRuns(runtime)[runId]);
    return {
      ok: true, statusCode: 202, run: current, queued: current.status === 'pending',
      queuePosition: current.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot, id: itemId, createdAt, runtime }) : null,
    };
  }
  logCodexContinueDebug('spawn-prep', { traceId, ledgerId, cardId, runId, newSession, command: command.command, args: command.args, model: command.model, effort: command.effort, sessionId, promptChars: prompt.length, messageCount: messages.length, outputFile });
  mkdirSync(runDirectory, { recursive: true });
  const eventStartLine = prepareCardSkillRunEventAppend(stdoutFile);
  const child = spawn(command.command, command.args, {
    cwd: workspaceRoot,
    env: decisionOsCodexEnvironment({ runtime, decisionOsRoot, ledgerFile: ledgerPath }),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  const stdout = createWriteStream(stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(stderrFile, { flags: 'a' });
  let terminalEventStatus: TerminalCodexStatus | null = null;
  const terminalReconciler = createTerminalCodexProcessReconciler({
    child,
    closeGraceMs: runtime.codexTerminalCloseGraceMs,
    forceKillGraceMs: runtime.codexTerminalForceKillGraceMs,
    onTerminalStatus: (status) => { terminalEventStatus = status; },
  });
  const runEventIngestor = createCardSkillRunEventIngestor({ decisionOsRoot, ledgerPath, cardId, runId, startLine: eventStartLine, telemetryFile: `${stdoutFile}.telemetry.jsonl`, projectId: String(runtime.projectId ?? ''), onTerminalEvent: terminalReconciler.observe });
  const continuedAt = new Date().toISOString();
  appendFileSync(stderrFile, codexRunSegmentMarker({
    runId,
    startedAt: continuedAt,
    segment: newSession ? 'restart' : 'continue',
    startLine: eventStartLine,
    metadata: {
      sourceCardTitle: String(card?.title ?? cardId),
      codexModel: command.model,
      codexEffort: command.effort
    }
  }), 'utf8');
  child.stdout.on('data', (chunk: Buffer) => {
    runEventIngestor.ingest(chunk);
    logCodexContinueDebug('child-stdout-chunk', { traceId, runId, pid: child.pid ?? 0, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) });
  });
  child.stderr.on('data', (chunk: Buffer) => {
    logCodexContinueDebug('child-stderr-chunk', { traceId, runId, pid: child.pid ?? 0, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) });
  });
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(prompt);

  const run = {
    id: runId,
    ledgerId,
    outputCardId: cardId,
    sourceCardTitle: String(card?.title ?? cardId),
    outputFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    newSession,
    resumeSessionId: newSession ? '' : sessionId,
    continuedMessageCount: messages.length,
    pid: child.pid ?? 0,
    status: 'running',
    startedAt: continuedAt,
    continuedAt,
  };
  updateRuntimeRun(runtime, runId, run);
  attachRuntimeRunChild(runtime, runId, child);
  logCodexContinueDebug('spawned', { traceId, ledgerId, cardId, runId, newSession, pid: child.pid ?? 0, continuedAt, continuedMessageCount: messages.length });

  let settled = false;
  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    logCodexContinueDebug('child-error', { traceId, ledgerId, cardId, runId, message: error.message, finishedAt });
    appendRunStatus(outputFile, 'failed', `${newSession ? 'new session' : 'resume'} failed: ${error.message}`);
    updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      flushCardSkillRunEventIngestor(runEventIngestor, runId);
      updateRuntimeRun(runtime, runId, { settledAt: new Date().toISOString() });
      if (queueItemId) removeCodexProcessQueueItem(decisionOsRoot, queueItemId);
      clearCardCodexActiveRun({ ledgerPath, cardId, runId });
      const schedule = runtime.scheduleCodexProcesses;
      if (typeof schedule === 'function') void schedule();
      notifyRunSettled(runtime.onCodexRunSettled, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, status: 'failed' });
    });
  });
  child.on('close', (exitCode) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    const status: ProcessStatus = runtimeRunStatus(runtime, runId) === 'cancelled' ? 'cancelled' : terminalEventStatus ?? (exitCode === 0 ? 'complete' : 'failed');
    const detail = status === 'cancelled' ? 'terminated by operator' : `${newSession ? 'new session' : 'resume'} exit code ${exitCode ?? 'unknown'}`;
    logCodexContinueDebug('child-close', { traceId, ledgerId, cardId, runId, exitCode, status, detail, finishedAt });
    appendRunStatus(outputFile, status, detail);
    updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      flushCardSkillRunEventIngestor(runEventIngestor, runId);
      updateRuntimeRun(runtime, runId, { settledAt: new Date().toISOString() });
      if (queueItemId) removeCodexProcessQueueItem(decisionOsRoot, queueItemId);
      clearCardCodexActiveRun({ ledgerPath, cardId, runId });
      const schedule = runtime.scheduleCodexProcesses;
      if (typeof schedule === 'function') void schedule();
      notifyRunSettled(runtime.onCodexRunSettled, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, status, exitCode });
    });
  });

  return { ok: true, statusCode: 202, run: publicRun(run) };
}
