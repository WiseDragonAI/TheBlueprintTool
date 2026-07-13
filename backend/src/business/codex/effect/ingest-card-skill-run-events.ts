/**
 * WHAT: Batches newline-delimited Codex stdout into durable card-thread events.
 * WHY: Stream scheduling belongs at the stdout ingestion boundary, separate from parsing and persistence details.
 */
import { StringDecoder } from 'node:string_decoder';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeCardSkillRunEvent } from '../helper/normalize-card-skill-run-event.js';
import {
  type CardSkillRunEventIngestor,
  type NormalizedRunEvent
} from '../helper/card-skill-run-event-types.js';
import { persistCardSkillRunEvents } from './persist-card-skill-run-events.js';

type AnyRecord = Record<string, unknown>;

export function createCardSkillRunEventIngestor(input: {
  decisionOsRoot: string;
  ledgerPath: string;
  cardId: string;
  runId: string;
  startLine?: number;
  batchDelayMs?: number;
  telemetryFile?: string;
}): CardSkillRunEventIngestor {
  const decoder = new StringDecoder('utf8');
  const pendingEvents = new Map<number, NormalizedRunEvent>();
  const batchDelayMs = Math.max(0, Number(input.batchDelayMs ?? 25));
  let nextLine = Math.max(0, Number(input.startLine ?? 0)) + 1;
  let remainder = '';
  let timer: NodeJS.Timeout | undefined;
  let turnId = '';
  const startedTools = new Map<string, { startedAt: string; tool: string }>();

  const persistTelemetry = (event: AnyRecord, normalized: NormalizedRunEvent): void => {
    if (!input.telemetryFile) return;
    const type = String(event.type ?? '');
    const item = event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item as AnyRecord : {};
    if (type === 'turn.started') turnId = String(item.id ?? event.turn_id ?? event.id ?? turnId);
    if (normalized.kind !== 'tool_call' || !normalized.itemId) return;
    const now = new Date();
    if (type === 'item.started') {
      startedTools.set(normalized.itemId, { startedAt: now.toISOString(), tool: normalized.tool || normalized.title });
      return;
    }
    if (type !== 'item.completed' && type !== 'item.failed') return;
    const started = startedTools.get(normalized.itemId);
    const startedAt = started?.startedAt ?? now.toISOString();
    const completedAt = now.toISOString();
    const durationMs = Math.max(0, now.getTime() - Date.parse(startedAt));
    const success = type === 'item.completed' && normalized.status !== 'failed' && normalized.exitCode !== '1';
    const row = { version: 1, startedAt, completedAt, durationMs, tool: started?.tool ?? normalized.tool ?? normalized.title, success, outputBytes: Buffer.byteLength(normalized.output), runId: input.runId, turnId, callId: normalized.itemId };
    mkdirSync(dirname(input.telemetryFile), { recursive: true });
    appendFileSync(input.telemetryFile, `${JSON.stringify(row)}\n`, 'utf8');
    startedTools.delete(normalized.itemId);
  };

  const enqueueLine = (rawLine: string): void => {
    const line = nextLine;
    nextLine += 1;
    const source = rawLine.replace(/\r$/, '');
    // WHAT: Ignore physical blank lines without changing their source-line identity.
    // WHY: Later event IDs must continue to match the JSONL file's physical line numbers.
    if (!source.trim()) return;
    try {
      const parsed = JSON.parse(source) as unknown;
      // WHAT: Accept only object-shaped Codex events.
      // WHY: Scalars and arrays have no lifecycle event contract to persist.
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const event = normalizeCardSkillRunEvent({ line, event: parsed as AnyRecord });
      persistTelemetry(parsed as AnyRecord, event);
      // WHAT: Queue only events that have a durable thread representation.
      // WHY: Empty informational records remain available in the JSONL source without creating blank notes.
      if (event.persist) pendingEvents.set(event.line, event);
    } catch {
      // WHAT: Leave malformed stdout exclusively in the JSONL artifact.
      // WHY: One incomplete producer line must not stop ingestion of later valid events.
    }
  };

  const persistPending = (): number => {
    // WHAT: Avoid ledger IO when the current batch contains no durable events.
    // WHY: Empty timer flushes must remain write-free.
    if (pendingEvents.size === 0) return 0;
    const events = [...pendingEvents.values()].sort((left, right) => left.line - right.line);
    const changed = persistCardSkillRunEvents({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath: input.ledgerPath,
      cardId: input.cardId,
      runId: input.runId,
      events,
    });
    pendingEvents.clear();
    return changed;
  };

  const schedulePersist = (): void => {
    // WHAT: Keep one timer for the current non-empty batch.
    // WHY: Repeated stdout chunks should coalesce into one durable write.
    if (timer || pendingEvents.size === 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      try {
        persistPending();
      } catch (error) {
        // WHAT: Report an asynchronous persistence failure without terminating the child stream.
        // WHY: The controller still needs to receive process settlement and attempt its final flush.
        console.error(`Could not persist Codex run events for ${input.runId}:`, error);
      }
    }, batchDelayMs);
  };

  return {
    ingest(chunk) {
      remainder += typeof chunk === 'string' ? chunk : decoder.write(chunk);
      const lines = remainder.split('\n');
      remainder = lines.pop() ?? '';
      for (const line of lines) enqueueLine(line);
      schedulePersist();
    },
    flush() {
      // WHAT: Cancel the deferred batch before performing the settlement flush.
      // WHY: Process settlement must not race a later timer against the same pending events.
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      remainder += decoder.end();
      // WHAT: Treat the final unterminated fragment as one physical JSONL line.
      // WHY: Codex may close stdout without a trailing newline.
      if (remainder) {
        enqueueLine(remainder);
        remainder = '';
      }
      if (input.telemetryFile && startedTools.size > 0) {
        const completedAt = new Date().toISOString();
        mkdirSync(dirname(input.telemetryFile), { recursive: true });
        for (const [callId, started] of startedTools) {
          appendFileSync(input.telemetryFile, `${JSON.stringify({ version: 1, startedAt: started.startedAt, completedAt, durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(started.startedAt)), tool: started.tool, success: false, status: 'interrupted', outputBytes: 0, runId: input.runId, turnId, callId })}\n`, 'utf8');
        }
        startedTools.clear();
      }
      return persistPending();
    },
  };
}
