/**
 * WHAT: Creates a linked output card and starts a headless Codex skill process for the source card.
 * WHY: Card-scoped skill processing must persist the result target before the asynchronous Codex run begins.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';
import { buildCardSkillPrompt } from '../helper/build-card-skill-prompt.js';
import { codexRunSegmentMarker } from '../helper/codex-run-segment-marker.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';

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

function sourceCardContent(input: { rawLedger: AnyRecord; decisionOsRoot: string; cardId: string }): string {
  const hydrated = hydrateLedgerCardContent(JSON.parse(JSON.stringify(input.rawLedger)), input.decisionOsRoot) as { cards?: AnyRecord[] };
  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return String(comment.what ?? comment.body ?? comment.description ?? '');
}

function persistLedger(ledgerPath: string, ledger: AnyRecord): void {
  stripHydratedThreadNotes(ledger);
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
}

function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
  try {
    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
  } catch {
    // The run log remains the fallback status record when the output file cannot be patched.
  }
}

function updateRuntimeRun(runtime: AnyRecord, runId: string, patch: AnyRecord): void {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  runs[runId] = { ...(runs[runId] ?? {}), ...patch };
}

function attachRuntimeRunChild(runtime: AnyRecord, runId: string, child: ChildProcess): void {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[runId];
  if (!run) return;
  Object.defineProperty(run, 'child', { value: child, writable: true, configurable: true, enumerable: false });
}

function runtimeRunStatus(runtime: AnyRecord, runId: string): string {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  return String(runs[runId]?.status ?? '');
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

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function startCardSkillProcessController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const skillName = String(payload.skillName ?? '').trim();
  if (!ledgerId || !cardId || !skillName) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or skillName.' };
  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };

  const skill = scanCodexSkills({ workspaceRoot }).find((entry) => entry.name === skillName);
  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[]; relationships?: AnyRecord[] };
  const source = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!source) return { ok: false, statusCode: 404, error: 'Source card not found.', cardId };

  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const outputCardId = `card-${safeSegment(runId)}`;
  const outputTitle = `${skillName} result`;
  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
  const outputCard = {
    id: outputCardId,
    title: outputTitle,
    cardType: 'codex-skill-run',
    x: Number(source.x ?? 0) + Math.max(220, Number(source.w ?? 360)) + 96,
    y: Number(source.y ?? 0),
    w: Math.max(360, Number(source.w ?? 360)),
    h: 260,
    status: 'todo',
    comment: { what: '\n' },
    facts: [],
    fields: [],
  };
  const relationship = {
    id: `rel-${safeSegment(cardId)}-${safeSegment(outputCardId)}`.slice(0, 180),
    from: cardId,
    to: outputCardId,
    label: skillName,
  };

  let mutation = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation: { action: 'create-card', card: outputCard } });
  if (mutation.ok === false) return { ok: false, statusCode: mutation.error?.statusCode ?? 400, error: mutation.error?.body?.error ?? 'Could not create output card.' };
  mutation = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation: { action: 'create-relationship', relationship } });
  if (mutation.ok === false) return { ok: false, statusCode: mutation.error?.statusCode ?? 400, error: mutation.error?.body?.error ?? 'Could not create relationship.' };
  persistLedger(ledgerPath, ledger);

  const outputComment = outputCard.comment && typeof outputCard.comment === 'object' ? outputCard.comment as AnyRecord : {};
  const outputFile = resolveCardContentFile(decisionOsRoot, outputComment.contentFile);
  if (!outputFile) return { ok: false, statusCode: 500, error: 'Output card content file was not created.' };

  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
  mkdirSync(runDirectory, { recursive: true });
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const prompt = buildCardSkillPrompt({
    skillName,
    ledgerFile: ledgerPath,
    sourceCardId: cardId,
    sourceCardTitle: String(source.title ?? cardId),
    sourceCardContent: sourceCardContent({ rawLedger: ledger, decisionOsRoot, cardId }),
    outputMarkdownFile: outputFile,
  });

  const child = spawn(command.command, command.args, { cwd: workspaceRoot, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = createWriteStream(stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(stderrFile, { flags: 'a' });
  const runEventIngestor = createCardSkillRunEventIngestor({ decisionOsRoot, ledgerPath, cardId: outputCardId, runId });
  const startedAt = new Date().toISOString();
  appendFileSync(stderrFile, codexRunSegmentMarker({
    runId,
    startedAt,
    segment: 'start',
    startLine: 0,
    metadata: {
      sourceCardTitle: String(source.title ?? cardId),
      codexModel: command.model,
      codexEffort: command.effort
    }
  }), 'utf8');
  child.stdout.on('data', (chunk: Buffer) => runEventIngestor.ingest(chunk));
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(prompt);

  const run = {
    id: runId,
    skillName,
    ledgerId,
    sourceCardId: cardId,
    sourceCardTitle: String(source.title ?? cardId),
    outputCardId,
    outputFile,
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

  let settled = false;
  child.on('error', (error) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    appendRunStatus(outputFile, 'failed', error.message);
    updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      flushCardSkillRunEventIngestor(runEventIngestor, runId);
    });
  });
  child.on('close', (exitCode) => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    const status: ProcessStatus = runtimeRunStatus(runtime, runId) === 'cancelled' ? 'cancelled' : exitCode === 0 ? 'complete' : 'failed';
    const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${exitCode ?? 'unknown'}`;
    appendRunStatus(outputFile, status, detail);
    updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      flushCardSkillRunEventIngestor(runEventIngestor, runId);
    });
  });

  return { ok: true, statusCode: 202, run };
}
