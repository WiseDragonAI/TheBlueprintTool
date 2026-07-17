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
  projectId?: string;
  onTerminalEvent?: (event: NormalizedRunEvent) => void;
  onTurnStarted?: (event: NormalizedRunEvent, observedAt: string) => void;
}): CardSkillRunEventIngestor {
  const decoder = new StringDecoder('utf8');
  const pendingEvents = new Map<number, NormalizedRunEvent>();
  const batchDelayMs = Math.max(0, Number(input.batchDelayMs ?? 25));
  let nextLine = Math.max(0, Number(input.startLine ?? 0)) + 1;
  let remainder = '';
  let timer: NodeJS.Timeout | undefined;
  let turnSequence = 0;
  let turnId = `${input.runId}:turn-${Math.max(0, Number(input.startLine ?? 0)) + 1}-0`;
  const startedTools = new Map<string, { startedAt: string; startedNs: bigint; tool: string; command: string; timingSource: 'producer' | 'observer' }>();

  const eventTime = (event: AnyRecord, item: AnyRecord): string | null => {
    const candidate = String(event.timestamp ?? event.created_at ?? item.timestamp ?? item.created_at ?? '');
    return candidate && Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : null;
  };

  const toolName = (item: AnyRecord, normalized: NormalizedRunEvent): string => {
    const type = String(item.type ?? '');
    if (type === 'command_execution') return 'shell';
    if (type === 'web_search') return 'web_search';
    if (type === 'file_change') return 'file_change';
    return String(item.name ?? type ?? normalized.kind ?? 'tool_call');
  };

  const persistTelemetry = (event: AnyRecord, normalized: NormalizedRunEvent): void => {
    if (!input.telemetryFile) return;
    const type = String(event.type ?? '');
    const item = event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item as AnyRecord : {};
    if (type === 'turn.started') {
      turnSequence += 1;
      turnId = String(item.id ?? event.turn_id ?? event.id ?? '') || `${input.runId}:turn-${Math.max(0, Number(input.startLine ?? 0)) + 1}-${turnSequence}`;
    }
    if (normalized.kind !== 'tool_call' || !normalized.itemId) return;
    const now = new Date();
    const key = `${turnId}:${normalized.itemId}`;
    if (type === 'item.started') {
      const producerTime = eventTime(event, item);
      startedTools.set(key, { startedAt: producerTime ?? now.toISOString(), startedNs: process.hrtime.bigint(), tool: toolName(item, normalized), command: normalized.tool || normalized.title, timingSource: producerTime ? 'producer' : 'observer' });
      return;
    }
    if (type !== 'item.completed' && type !== 'item.failed') return;
    const started = startedTools.get(key);
    const completedProducerTime = eventTime(event, item);
    const startedAt = started?.startedAt ?? completedProducerTime ?? now.toISOString();
    const completedAt = completedProducerTime ?? now.toISOString();
    const producerDuration = completedProducerTime && started?.timingSource === 'producer' ? Date.parse(completedAt) - Date.parse(startedAt) : Number.NaN;
    const observerDuration = started ? Number(process.hrtime.bigint() - started.startedNs) / 1_000_000 : Number.NaN;
    const durationMs = Number.isFinite(producerDuration) && producerDuration > 0 ? producerDuration : Number.isFinite(observerDuration) && observerDuration > 0 ? observerDuration : null;
    const exitCode = normalized.exitCode === '' ? 0 : Number(normalized.exitCode);
    const success = type === 'item.completed' && normalized.status !== 'failed' && (!Number.isFinite(exitCode) || exitCode === 0);
    const row = { version: 2, projectId: input.projectId ?? process.env.DECISION_OS_PROJECT_ID ?? '', startedAt, completedAt, durationMs, timingSource: Number.isFinite(producerDuration) && producerDuration > 0 ? 'producer' : started ? 'observer' : 'unavailable', tool: started?.tool ?? toolName(item, normalized), command: started?.command ?? normalized.tool ?? normalized.title, success, status: normalized.status, outputBytes: Buffer.byteLength(normalized.output), runId: input.runId, turnId, callId: key };
    mkdirSync(dirname(input.telemetryFile), { recursive: true });
    appendFileSync(input.telemetryFile, `${JSON.stringify(row)}\n`, 'utf8');
    startedTools.delete(key);
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
      if (event.type === 'turn.started') input.onTurnStarted?.(event, new Date().toISOString());
      if (event.kind === 'run_status' && (event.status === 'complete' || event.status === 'failed' || event.status === 'cancelled')) {
        input.onTerminalEvent?.(event);
      }
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
          const durationMs = Number(process.hrtime.bigint() - started.startedNs) / 1_000_000;
          appendFileSync(input.telemetryFile, `${JSON.stringify({ version: 2, projectId: input.projectId ?? process.env.DECISION_OS_PROJECT_ID ?? '', startedAt: started.startedAt, completedAt, durationMs: durationMs > 0 ? durationMs : null, timingSource: 'observer', tool: started.tool, command: started.command, success: false, status: 'interrupted', outputBytes: 0, runId: input.runId, turnId, callId })}\n`, 'utf8');
        }
        startedTools.clear();
      }
      return persistPending();
    },
  };
}
