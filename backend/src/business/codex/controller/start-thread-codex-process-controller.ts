/**
 * WHAT: Starts a headless Codex process scoped to one card thread.
 * WHY: The thread panel needs a direct Codex action that continues against the same thread messages.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, type WriteStream } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { externalizeCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { formatThreadMarkdown, hydrateLedgerThreadNotes, resolveThreadContentFile, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { prepareCardSkillRunEventAppend } from '../effect/prepare-card-skill-run-event-append.js';
import { buildThreadCodexPrompt } from '../helper/build-thread-codex-prompt.js';
import { codexRunSegmentMarker } from '../helper/codex-run-segment-marker.js';
import { isCodexThreadArtifactNote } from '../helper/is-codex-thread-artifact-note.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand, resolveCodexResumeCommand, type CodexCommand } from '../helper/resolve-codex-command.js';
import { codexCapacityResumeDelayMs, isTransientCodexCapacityFailure, readCodexSessionId } from '../helper/transient-codex-capacity-failure.js';
import { decisionOsCodexEnvironment } from '../helper/decision-os-codex-runtime.js';

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

function notifyRunSettled(callback: unknown, event: AnyRecord): void {
  if (typeof callback === 'function') callback(event);
}

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
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

function runtimeRunStatus(runtime: AnyRecord, runId: string): string {
  return String(runtimeRuns(runtime)[runId]?.status ?? '');
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

function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
  try {
    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
  } catch {
    // The JSONL and stderr files remain the fallback status record.
  }
}

function cardContentFile(input: { decisionOsRoot: string; card: AnyRecord; ledgerPath: string }): string {
  externalizeCardContent({ decisionOsRoot: input.decisionOsRoot, card: input.card, ledgerPath: input.ledgerPath });
  const comment = input.card.comment && typeof input.card.comment === 'object' ? input.card.comment as AnyRecord : {};
  return resolveCardContentFile(input.decisionOsRoot, comment.contentFile) ?? '';
}

function threadContentFile(input: { decisionOsRoot: string; ledger: AnyRecord; ledgerPath: string; threadId: string }): string {
  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
  const notes = normalizeLedgerNotes(input.ledger)[input.threadId] ?? [];
  writeThreadNotesFile({ decisionOsRoot: input.decisionOsRoot, ledger: input.ledger, ledgerPath: input.ledgerPath, threadId: input.threadId, notes });
  const threadFiles = input.ledger.threadFiles && typeof input.ledger.threadFiles === 'object' ? input.ledger.threadFiles as Record<string, unknown> : {};
  return resolveThreadContentFile(input.decisionOsRoot, threadFiles[input.threadId]) ?? '';
}

function threadMarkdownForPrompt(input: { decisionOsRoot: string; ledger: AnyRecord; threadId: string }): { markdown: string; operatorNoteTimestamp: string } | null {
  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
  const notes = (normalizeLedgerNotes(input.ledger)[input.threadId] ?? [])
    .filter((note) => !isCodexThreadArtifactNote(note));
  let operatorNote: AnyRecord | undefined;
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    if (String(notes[index].role ?? '').toLowerCase() !== 'operator') continue;
    operatorNote = notes[index];
    break;
  }
  const operatorNoteTimestamp = typeof operatorNote?.timestamp === 'string' ? operatorNote.timestamp : '';
  const parsedTimestamp = new Date(operatorNoteTimestamp);
  if (!operatorNoteTimestamp || Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== operatorNoteTimestamp) return null;
  return { markdown: formatThreadMarkdown(notes), operatorNoteTimestamp };
}

function publicRun(run: AnyRecord): AnyRecord {
  const { child: _child, ...rest } = run;
  return rest;
}

export async function startThreadCodexProcessController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const threadId = String(payload.threadId ?? '').trim();
  const payloadCardId = String(payload.cardId ?? '').trim();
  const cardId = payloadCardId || threadId.replace(/^thread-/, '');
  if (!ledgerId || !threadId || !cardId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, threadId, or cardId.' };
  if (threadId !== `thread-${cardId}`) return { ok: false, statusCode: 400, error: 'Thread is not a card thread.', threadId, cardId };

  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
  const source = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!source) return { ok: false, statusCode: 404, error: 'Thread target card not found.', cardId, threadId };
  const sourceCardFile = cardContentFile({ decisionOsRoot, card: source, ledgerPath });
  const sourceThreadFile = threadContentFile({ decisionOsRoot, ledger, ledgerPath, threadId });
  if (!sourceCardFile || !sourceThreadFile) return { ok: false, statusCode: 500, error: 'Could not resolve card or thread markdown file.', cardId, threadId };
  const threadPrompt = threadMarkdownForPrompt({ decisionOsRoot, ledger, threadId });
  if (!threadPrompt) return {
    ok: false,
    statusCode: 400,
    error: 'The latest operator note must have an exact ISO timestamp before Codex can start.',
    cardId,
    threadId,
  };
  const existingRunId = String(source.codexThreadRunId ?? '').trim();
  if (existingRunId) return {
    ok: false,
    statusCode: 409,
    error: 'Thread already owns a Codex run. Continue the existing run or explicitly start a new session.',
    cardId,
    threadId,
    runId: existingRunId,
  };

  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDirectoryRef = `.decision-os/runs/codex-skills/${safeSegment(ledgerStem(ledgerPath))}`;
  const runDirectory = resolve(decisionOsRoot, runDirectoryRef.replace(/^\.decision-os\//, ''));
  mkdirSync(runDirectory, { recursive: true });
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const runSummaryRef = `${runDirectoryRef}/${safeSegment(runId)}.md`;
  const runSummaryFile = resolve(decisionOsRoot, runSummaryRef.replace(/^\.decision-os\//, ''));
  writeFileSync(runSummaryFile, [`# Thread Codex Run`, '', `Status: processing`, `Source card: ${String(source.title ?? cardId)}`, `Source thread: ${threadId}`, `Codex run: ${runId}`].join('\n'), 'utf8');

  const prompt = buildThreadCodexPrompt({
    workspaceRoot,
    ledgerFile: ledgerPath,
    cardId,
    cardTitle: String(source.title ?? cardId),
    cardMarkdownFile: sourceCardFile,
    cardMarkdown: readFileSync(sourceCardFile, 'utf8'),
    threadId,
    threadMarkdownFile: sourceThreadFile,
    threadMarkdown: threadPrompt.markdown,
    runSummaryFile,
    operatorNoteTimestamp: threadPrompt.operatorNoteTimestamp,
  });
  const command = resolveCodexCommand({
    workspaceRoot,
    runtime,
    codexModel: requestedCodexModel,
    codexEffort: requestedCodexEffort,
    developerInstructions: prompt.developerInstructions,
  });
  source.codexThreadRunId = runId;
  source.codexThreadRunOutputFile = runSummaryRef;
  source.codexRunModel = command.model;
  source.codexRunEffort = command.effort;
  stripHydratedThreadNotes(ledger);
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');

  const startedAt = new Date().toISOString();
  const run = {
    id: runId,
    skillName: 'decision-os-thread',
    kind: 'thread',
    ledgerId,
    sourceCardId: cardId,
    sourceCardTitle: String(source.title ?? cardId),
    sourceThreadId: threadId,
    outputCardId: cardId,
    outputFile: runSummaryFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    pid: 0,
    status: 'running',
    startedAt,
  };
  updateRuntimeRun(runtime, runId, run);

  const launch = (attemptCommand: CodexCommand, taskInput: string, segment: 'start' | 'continue'): void => {
    const eventStartLine = segment === 'start' ? 0 : prepareCardSkillRunEventAppend(stdoutFile);
    const stdoutByteOffset = existsSync(stdoutFile) ? statSync(stdoutFile).size : 0;
    const stderrByteOffset = existsSync(stderrFile) ? statSync(stderrFile).size : 0;
    const attemptStartedAt = new Date().toISOString();
    const child = spawn(attemptCommand.command, attemptCommand.args, {
      cwd: workspaceRoot,
      env: decisionOsCodexEnvironment({ runtime, decisionOsRoot, ledgerFile: ledgerPath }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = createWriteStream(stdoutFile, { flags: 'a' });
    const stderr = createWriteStream(stderrFile, { flags: 'a' });
    const runEventIngestor = createCardSkillRunEventIngestor({ decisionOsRoot, ledgerPath, cardId, runId, startLine: eventStartLine, telemetryFile: `${stdoutFile}.telemetry.jsonl` });
    appendFileSync(stderrFile, codexRunSegmentMarker({
      runId,
      startedAt: attemptStartedAt,
      segment,
      startLine: eventStartLine,
      metadata: {
        sourceCardTitle: String(source.title ?? cardId),
        sourceThreadId: threadId,
        codexModel: attemptCommand.model,
        codexEffort: attemptCommand.effort
      }
    }), 'utf8');
    updateRuntimeRun(runtime, runId, { pid: child.pid ?? 0, status: 'running', transientRetryAt: null });
    attachRuntimeRunChild(runtime, runId, child);
    child.stdout.on('data', (chunk: Buffer) => runEventIngestor.ingest(chunk));
    child.stdout.pipe(stdout, { end: false });
    child.stderr.pipe(stderr, { end: false });
    child.stdin.end(taskInput);

    let attemptSettled = false;
    child.on('error', (error) => {
      if (attemptSettled) return;
      attemptSettled = true;
      const finishedAt = new Date().toISOString();
      appendRunStatus(runSummaryFile, 'failed', error.message);
      updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
      finishRunStreams(stdout, stderr, () => {
        flushCardSkillRunEventIngestor(runEventIngestor, runId);
        notifyRunSettled(runtime.onCodexRunSettled, { ledgerId, cardId, threadId, runId, status: 'failed' });
      });
    });
    child.on('close', (exitCode) => {
      if (attemptSettled) return;
      attemptSettled = true;
      finishRunStreams(stdout, stderr, () => {
        flushCardSkillRunEventIngestor(runEventIngestor, runId);
        const cancelled = runtimeRunStatus(runtime, runId) === 'cancelled';
        const sessionId = exitCode === 0 || cancelled ? '' : readCodexSessionId(stdoutFile);
        if (!cancelled && exitCode !== 0 && sessionId && isTransientCodexCapacityFailure({
          stdoutFile,
          stderrFile,
          stdoutByteOffset,
          stderrByteOffset,
        })) {
          const retryAt = new Date(Date.now() + codexCapacityResumeDelayMs).toISOString();
          appendRunStatus(runSummaryFile, 'running', `model capacity reached; resuming the same session after ${codexCapacityResumeDelayMs / 1000} seconds`);
          updateRuntimeRun(runtime, runId, { status: 'running', transientRetryAt: retryAt, exitCode });
          setTimeout(() => {
            if (runtimeRunStatus(runtime, runId) !== 'running') return;
            const resumeCommand = resolveCodexResumeCommand({
              workspaceRoot,
              runtime,
              sessionId,
              codexModel: command.model,
              codexEffort: command.effort,
            });
            launch(resumeCommand, 'Continue the interrupted task from the durable session context.', 'continue');
          }, codexCapacityResumeDelayMs);
          return;
        }
        const finishedAt = new Date().toISOString();
        const status: ProcessStatus = cancelled ? 'cancelled' : exitCode === 0 ? 'complete' : 'failed';
        const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${exitCode ?? 'unknown'}`;
        appendRunStatus(runSummaryFile, status, detail);
        updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
        if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
        notifyRunSettled(runtime.onCodexRunSettled, { ledgerId, cardId, threadId, runId, status, exitCode });
      });
    });
  };

  launch(command, prompt.taskContext, 'start');

  return { ok: true, statusCode: 202, run: publicRun(runtimeRuns(runtime)[runId]) };
}
