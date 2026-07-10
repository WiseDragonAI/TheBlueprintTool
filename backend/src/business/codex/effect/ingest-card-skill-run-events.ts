/**
 * WHAT: Batches newline-delimited Codex stdout into durable card-thread events.
 * WHY: Stream scheduling belongs at the stdout ingestion boundary, separate from parsing and persistence details.
 */
import { StringDecoder } from 'node:string_decoder';
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
}): CardSkillRunEventIngestor {
  const decoder = new StringDecoder('utf8');
  const pendingEvents = new Map<number, NormalizedRunEvent>();
  const batchDelayMs = Math.max(0, Number(input.batchDelayMs ?? 25));
  let nextLine = Math.max(0, Number(input.startLine ?? 0)) + 1;
  let remainder = '';
  let timer: NodeJS.Timeout | undefined;

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
      return persistPending();
    },
  };
}
