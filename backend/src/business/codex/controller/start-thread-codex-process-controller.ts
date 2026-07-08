/**
 * WHAT: Starts a headless Codex process scoped to one card thread.
 * WHY: The thread panel needs a direct Codex action that continues against the same thread messages.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { externalizeCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { hydrateLedgerThreadNotes, resolveThreadContentFile, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { buildThreadCodexPrompt } from '../helper/build-thread-codex-prompt.js';
import { codexRunSegmentMarker } from '../helper/codex-run-segment-marker.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';
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

function notifyLedgerChange(callback: unknown, event: AnyRecord): void {
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

  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDirectoryRef = `.decision-os/runs/codex-skills/${safeSegment(ledgerStem(ledgerPath))}`;
  const runDirectory = resolve(decisionOsRoot, runDirectoryRef.replace(/^\.decision-os\//, ''));
  mkdirSync(runDirectory, { recursive: true });
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const runSummaryRef = `${runDirectoryRef}/${safeSegment(runId)}.md`;
  const runSummaryFile = resolve(decisionOsRoot, runSummaryRef.replace(/^\.decision-os\//, ''));
  writeFileSync(runSummaryFile, [`# Thread Codex Run`, '', `Status: processing`, `Source card: ${String(source.title ?? cardId)}`, `Source thread: ${threadId}`, `Codex run: ${runId}`].join('\n'), 'utf8');

  source.codexThreadRunId = runId;
  source.codexThreadRunOutputFile = runSummaryRef;
  stripHydratedThreadNotes(ledger);
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');

  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
  const prompt = buildThreadCodexPrompt({
    workspaceRoot,
    ledgerFile: ledgerPath,
    cardId,
    cardTitle: String(source.title ?? cardId),
    cardMarkdownFile: sourceCardFile,
    cardMarkdown: readFileSync(sourceCardFile, 'utf8'),
    threadId,
    threadMarkdownFile: sourceThreadFile,
    threadMarkdown: readFileSync(sourceThreadFile, 'utf8'),
    runSummaryFile,
  });

  const child = spawn(command.command, command.args, { cwd: workspaceRoot, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = createWriteStream(stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(stderrFile, { flags: 'a' });
  const startedAt = new Date().toISOString();
  appendFileSync(stderrFile, codexRunSegmentMarker({ runId, startedAt, segment: 'start' }), 'utf8');
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(prompt);

  const run = {
    id: runId,
    skillName: 'decision-os-thread',
    kind: 'thread',
    ledgerId,
    sourceCardId: cardId,
    sourceThreadId: threadId,
    outputCardId: cardId,
    outputFile: runSummaryFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    pid: child.pid ?? 0,
    status: 'running',
    startedAt,
  };
  updateRuntimeRun(runtime, runId, run);
  attachRuntimeRunChild(runtime, runId, child);
  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-thread-started', ledgerId, cardId, threadId, runId, codexModel: command.model, codexEffort: command.effort });

  let settled = false;
  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    appendRunStatus(runSummaryFile, 'failed', error.message);
    updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      void readCardSkillRunController({ action_payload: { ledgerId, cardId, runId }, runtime_state: runtime })
        .catch(() => undefined)
        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-thread-failed', ledgerId, cardId, threadId, runId }));
    });
  });
  child.on('close', (exitCode) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    const status: ProcessStatus = runtimeRunStatus(runtime, runId) === 'cancelled' ? 'cancelled' : exitCode === 0 ? 'complete' : 'failed';
    const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${exitCode ?? 'unknown'}`;
    appendRunStatus(runSummaryFile, status, detail);
    updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      void readCardSkillRunController({ action_payload: { ledgerId, cardId, runId }, runtime_state: runtime })
        .catch(() => undefined)
        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-thread-cancelled' : 'codex-thread-finished', ledgerId, cardId, threadId, runId, exitCode }));
    });
  });

  return { ok: true, statusCode: 202, run: publicRun(run) };
}
