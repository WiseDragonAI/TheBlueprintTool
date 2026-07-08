/**
 * WHAT: Reads one card-scoped Codex skill run from its derived JSONL/log files.
 * WHY: The output card and run id are enough to hydrate live progress without a persisted run manifest.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { hydrateLedgerCardContent } from '@backend/business/ledger/helper/card-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { hydrateLedgerThreadNotes, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { latestCodexRunSegmentStartedAtMs } from '../helper/codex-run-segment-marker.js';

type AnyRecord = Record<string, unknown>;
type RunStatus = 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';

type ParsedRunLine = {
  line: number;
  event: AnyRecord;
};

type NormalizedRunEvent = {
  line: number;
  type: string;
  kind: string;
  title: string;
  text: string;
  status: string;
  itemId: string;
  tool: string;
  exitCode: string;
  persist: boolean;
};

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

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function runTimestamp(runId: string): number {
  const match = runId.match(/^codex-skill-(\d+)-/);
  const timestamp = Number(match?.[1] ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function commandText(command: unknown): string {
  if (Array.isArray(command)) return command.map((entry) => String(entry)).join(' ');
  return String(command ?? '').trim();
}

function textBlock(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return String(entry ?? '');
      const record = entry as AnyRecord;
      return String(record.text ?? record.summary ?? record.message ?? JSON.stringify(record));
    }).join('\n').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  }
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2).replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function itemRecord(event: AnyRecord): AnyRecord {
  return event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item as AnyRecord : {};
}

function changesText(changes: unknown): string {
  if (!Array.isArray(changes)) return textBlock(changes) || 'File changes recorded.';
  return changes.map((change) => {
    if (!change || typeof change !== 'object' || Array.isArray(change)) return `- ${String(change)}`;
    const record = change as AnyRecord;
    const path = String(record.path ?? record.file ?? record.name ?? 'file');
    const action = String(record.kind ?? record.type ?? record.action ?? record.status ?? 'changed');
    return `- ${path}: ${action}`;
  }).join('\n');
}

function normalizeRunEvent(line: ParsedRunLine): NormalizedRunEvent {
  const event = line.event;
  const type = String(event.type ?? '');
  const item = itemRecord(event);
  const itemType = String(item.type ?? '');
  const itemId = String(item.id ?? event.id ?? '');
  const status = String(item.status ?? event.status ?? '');
  if (type === 'turn.completed') {
    return { line: line.line, type, kind: 'run_status', title: 'Turn completed', text: 'Codex turn completed.', status: 'complete', itemId, tool: '', exitCode: '', persist: true };
  }
  if (type === 'turn.started') {
    return { line: line.line, type, kind: 'run_status', title: 'Turn started', text: 'Codex turn started.', status: 'running', itemId, tool: '', exitCode: '', persist: true };
  }
  if (type === 'thread.started') {
    return { line: line.line, type, kind: 'run_status', title: 'Thread started', text: 'Codex thread started.', status: 'running', itemId, tool: '', exitCode: '', persist: true };
  }
  if (itemType === 'agent_message') {
    const text = textBlock(item.text ?? item.message ?? event.text);
    return { line: line.line, type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
  }
  if (/reason|thinking|thought/i.test(itemType)) {
    const text = textBlock(item.text ?? item.summary ?? item.message ?? event.text);
    return { line: line.line, type, kind: 'thinking', title: 'Codex thinking', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
  }
  if (itemType === 'command_execution') {
    const tool = commandText(item.command);
    const output = textBlock(item.aggregated_output ?? item.output ?? item.stderr ?? item.stdout);
    const exitCode = item.exit_code === undefined || item.exit_code === null ? '' : String(item.exit_code);
    const command = tool ? `\`${tool}\`` : 'command';
    const parts = [`**Tool call** ${command}`];
    if (status) parts.push(`Status: ${status}`);
    if (exitCode) parts.push(`Exit code: ${exitCode}`);
    if (output) parts.push('', '```text', output, '```');
    return { line: line.line, type, kind: 'tool_call', title: tool || 'Tool call', text: parts.join('\n'), status, itemId, tool, exitCode, persist: true };
  }
  if (itemType === 'file_change') {
    const text = changesText(item.changes);
    return { line: line.line, type, kind: 'file_change', title: 'File changes', text, status, itemId, tool: '', exitCode: '', persist: true };
  }
  const text = textBlock(item.text ?? item.message ?? event.text);
  return {
    line: line.line,
    type,
    kind: itemType || type || 'event',
    title: itemType || type || 'Codex event',
    text,
    status,
    itemId,
    tool: '',
    exitCode: '',
    persist: Boolean(text),
  };
}

function readJsonlLines(file: string): ParsedRunLine[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      const parsed = JSON.parse(line) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [{ line: index + 1, event: parsed as AnyRecord }] : [];
    } catch {
      return [];
    }
  });
}

function runtimeRunStatus(runtime: AnyRecord, runId: string): RunStatus | null {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[runId];
  const status = String(run?.status ?? '');
  return status === 'running' || status === 'complete' || status === 'failed' || status === 'cancelled' ? status : null;
}

function latestRunEventStatus(events: NormalizedRunEvent[]): RunStatus | null {
  let status: RunStatus | null = null;
  for (const event of events) {
    if (event.type === 'thread.started' || event.type === 'turn.started') status = 'running';
    if (event.type === 'turn.completed') status = 'complete';
    if (/cancelled|canceled/i.test(event.type)) status = 'cancelled';
    if (/failed|error/i.test(event.type)) status = 'failed';
  }
  return status;
}

function inferredStatus(input: { runtime: AnyRecord; runId: string; events: NormalizedRunEvent[]; stdoutFile: string; stderrFile: string }): RunStatus {
  const runtimeStatus = runtimeRunStatus(input.runtime, input.runId);
  if (runtimeStatus) return runtimeStatus;
  const log = existsSync(input.stderrFile) ? readFileSync(input.stderrFile, 'utf8') : '';
  const logStatus: RunStatus | null = /cancelled|canceled|terminated by operator/i.test(log)
    ? 'cancelled'
    : /(spawn|enoent|failed|exit code [1-9]|error:)/i.test(log)
      ? 'failed'
      : null;
  const latestStatus = latestRunEventStatus(input.events);
  const stdoutMtime = fileMtimeMs(input.stdoutFile);
  const stderrMtime = fileMtimeMs(input.stderrFile);
  if (logStatus && stderrMtime >= stdoutMtime) return logStatus;
  if (latestStatus === 'complete') return 'complete';
  if (!existsSync(input.stdoutFile)) return 'unknown';
  const newestWrite = Math.max(stdoutMtime, stderrMtime);
  if (latestStatus === 'running') return Date.now() - newestWrite < 120000 ? 'running' : 'unknown';
  return logStatus ?? (Date.now() - newestWrite < 120000 ? 'running' : 'unknown');
}

function fileMtimeMs(file: string): number {
  return existsSync(file) ? statSync(file).mtimeMs : 0;
}

function noteCodexLine(note: AnyRecord): number {
  const line = Number(note.codexLine ?? 0);
  return Number.isFinite(line) && line > 0 ? line : 0;
}

function runSegmentStartedAtMs(input: { runtime: AnyRecord; runId: string; stderrFile: string }): number {
  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[input.runId] ?? {};
  const runtimeStarted = Date.parse(String(run.startedAt ?? ''));
  const log = existsSync(input.stderrFile) ? readFileSync(input.stderrFile, 'utf8') : '';
  return runtimeStarted || latestCodexRunSegmentStartedAtMs({ log, runId: input.runId }) || runTimestamp(input.runId);
}

function elapsedMs(input: { runtime: AnyRecord; runId: string; status: RunStatus; stdoutFile: string; stderrFile: string }): number {
  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[input.runId] ?? {};
  const started = runSegmentStartedAtMs({ runtime: input.runtime, runId: input.runId, stderrFile: input.stderrFile });
  const finished = Date.parse(String(run.finishedAt ?? ''));
  const terminalFileWrite = Math.max(fileMtimeMs(input.stdoutFile), fileMtimeMs(input.stderrFile));
  const end = finished || (input.status === 'running' ? Date.now() : terminalFileWrite || Date.now());
  return Math.max(0, end - started);
}

function cardReferencesRun(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string; runId: string }): boolean {
  const hydrated = hydrateLedgerCardContent(JSON.parse(JSON.stringify(input.ledger)), input.decisionOsRoot) as { cards?: AnyRecord[] };
  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) return false;
  if (String(card.codexThreadRunId ?? '') === input.runId || String(card.codexRunId ?? '') === input.runId) return true;
  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  const body = String(comment.what ?? comment.body ?? comment.description ?? '');
  return body.includes(`Codex run: ${input.runId}`);
}

function persistRunEvents(input: { decisionOsRoot: string; ledgerPath: string; ledger: AnyRecord; cardId: string; runId: string; events: NormalizedRunEvent[] }): number {
  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
  const threadId = `thread-${input.cardId}`;
  const notesByThread = normalizeLedgerNotes(input.ledger);
  const notes = notesByThread[threadId] ?? [];
  const byId = new Map(notes.map((note) => [String(note.id ?? ''), note]));
  let changed = 0;
  for (const event of input.events) {
    if (!event.persist) continue;
    const id = `codex-${safeSegment(input.runId)}-line-${event.line}`;
    const existing = byId.get(id);
    const nextNote: AnyRecord = {
      id,
      role: 'agent',
      message: event.text || event.title,
      timestamp: String(existing?.timestamp ?? '') || new Date().toISOString(),
      status: event.status || event.title,
      codexRunId: input.runId,
      codexLine: String(event.line),
      codexKind: event.kind,
      codexEventType: event.type,
      codexItemId: event.itemId,
      codexTool: event.tool,
      codexExitCode: event.exitCode,
    };
    if (existing) {
      const previous = JSON.stringify(existing);
      Object.assign(existing, nextNote);
      if (JSON.stringify(existing) !== previous) changed += 1;
    } else {
      const insertAt = notes.findIndex((note) => String(note.codexRunId ?? '') === input.runId && noteCodexLine(note) > event.line);
      if (insertAt >= 0) notes.splice(insertAt, 0, nextNote);
      else notes.push(nextNote);
      byId.set(id, nextNote);
      changed += 1;
    }
  }
  if (changed > 0) {
    notesByThread[threadId] = notes;
    writeThreadNotesFile({ decisionOsRoot: input.decisionOsRoot, ledger: input.ledger, ledgerPath: input.ledgerPath, threadId, notes });
    stripHydratedThreadNotes(input.ledger);
    writeFileSync(input.ledgerPath, JSON.stringify(input.ledger, null, 2), 'utf8');
  }
  return changed;
}

export async function readCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const since = Math.max(0, Number(payload.since ?? 0) || 0);
  const traceId = String(payload.traceId ?? '');
  logCodexContinueDebug('read-controller-entry', { traceId, ledgerId, cardId, runId, since });
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
  if (!cardReferencesRun({ ledger, decisionOsRoot, cardId, runId })) return { ok: false, statusCode: 404, error: 'Run not found on card.', cardId, runId };

  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const parsedLines = readJsonlLines(stdoutFile);
  const events = parsedLines.map(normalizeRunEvent);
  const status = inferredStatus({ runtime, runId, events, stdoutFile, stderrFile });
  const persistedEventCount = persistRunEvents({ decisionOsRoot, ledgerPath, ledger, cardId, runId, events });
  const returnedEvents = events.filter((event) => event.line > since);
  logCodexContinueDebug('read-controller-result', {
    traceId,
    ledgerId,
    cardId,
    runId,
    since,
    status,
    parsedLineCount: parsedLines.length,
    lineCount: parsedLines.at(-1)?.line ?? 0,
    returnedEventCount: returnedEvents.length,
    persistedEventCount,
    latestEventType: events.at(-1)?.type ?? '',
    latestEventLine: events.at(-1)?.line ?? 0,
    stdoutFile,
    stderrFile,
  });
  return {
    ok: true,
    statusCode: 200,
    ledgerId,
    cardId,
    runId,
    status,
    startedAt: new Date(runSegmentStartedAtMs({ runtime, runId, stderrFile })).toISOString(),
    elapsedMs: elapsedMs({ runtime, runId, status, stdoutFile, stderrFile }),
    lineCount: parsedLines.at(-1)?.line ?? 0,
    nextSince: parsedLines.at(-1)?.line ?? 0,
    toolCallCount: events.filter((event) => event.kind === 'tool_call' && event.type === 'item.completed').length,
    agentMessageCount: events.filter((event) => event.kind === 'agent_message').length,
    fileChangeCount: events.filter((event) => event.kind === 'file_change').length,
    thinkingCount: events.filter((event) => event.kind === 'thinking').length,
    persistedEventCount,
    latestEvent: events.at(-1) ?? null,
    events: returnedEvents,
  };
}
