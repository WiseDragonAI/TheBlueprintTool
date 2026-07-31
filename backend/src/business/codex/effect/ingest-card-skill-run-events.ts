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
import type { TaskExecutionPresentationEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { taskExecutionPresentationEvents } from '../helper/task-execution-presentation-events.js';
import { persistCardSkillRunEvents } from './persist-card-skill-run-events.js';
import { reportCodexBackgroundFailure } from '../helper/codex-runtime-run-store.js';

type AnyRecord = Record<string, unknown>;

export function createCardSkillRunEventIngestor(input: {
  decisionOsRoot: string;
  ledgerId?: string;
  ledgerPath: string;
  cardId: string;
  runId: string;
  executionId: string;
  startLine?: number;
  batchDelayMs?: number;
  presentationBatchDelayMs?: number;
  telemetryFile?: string;
  projectId?: string;
  runtime?: AnyRecord;
  onTerminalEvent?: (event: NormalizedRunEvent) => void;
  onTurnStarted?: (event: NormalizedRunEvent, observedAt: string) => void;
  onPresentationEvents?: (input: {
    projectId: string;
    executionId: string;
    events: TaskExecutionPresentationEvent[];
  }) => void;
}): CardSkillRunEventIngestor {
  const decoder = new StringDecoder('utf8');
  const pendingEvents = new Map<number, NormalizedRunEvent>();
  const pendingPresentationEvents = new Map<number, NormalizedRunEvent>();
  let userPrompt = '';
  let startPresentationQueued = false;
  const batchDelayMs = Math.max(0, Number(input.batchDelayMs ?? 25));
  const presentationBatchDelayMs = Math.max(batchDelayMs, Number(input.presentationBatchDelayMs ?? 500));
  let nextLine = Math.max(0, Number(input.startLine ?? 0)) + 1;
  let remainder = '';
  let newlineSearchOffset = 0;
  let timer: NodeJS.Timeout | undefined;
  let presentationTimer: NodeJS.Timeout | undefined;
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
      let event = normalizeCardSkillRunEvent({ line, event: parsed as AnyRecord });
      // WHAT: Ignore legacy synthetic user-prompt lines during live ingestion.
      // WHY: Process input must not be copied into presentation state or subsequent lifecycle events.
      if (event.type === 'decision_os.user_prompt') return;
      if (event.type === 'decision_os.developer_prompt') userPrompt = event.text;
      else if (userPrompt && (event.type === 'thread.started' || event.type === 'turn.started')) {
        event = { ...event, text: userPrompt };
      }
      persistTelemetry(parsed as AnyRecord, event);
      if (event.type === 'turn.started') input.onTurnStarted?.(event, new Date().toISOString());
      if (event.kind === 'run_status' && (event.status === 'complete' || event.status === 'failed' || event.status === 'cancelled')) {
        input.onTerminalEvent?.(event);
      }
      const start = event.type === 'thread.started' || event.type === 'turn.started';
      if (!(start && (userPrompt || startPresentationQueued))) {
        pendingPresentationEvents.set(event.line, event);
        if (start) startPresentationQueued = true;
      }
      // WHAT: Queue only events that have a durable thread representation.
      // WHY: Empty informational records remain available in the JSONL source without creating blank notes.
      if (event.persist) pendingEvents.set(event.line, event);
    } catch {
      // WHAT: Leave malformed stdout exclusively in the JSONL artifact.
      // WHY: One incomplete producer line must not stop ingestion of later valid events.
    }
  };

  const publishPendingPresentation = (): void => {
    if (pendingPresentationEvents.size === 0) return;
    const events = taskExecutionPresentationEvents(
      [...pendingPresentationEvents.values()].sort((left, right) => left.line - right.line),
    );
    pendingPresentationEvents.clear();
    if (events.length === 0) return;
    const update = { projectId: input.projectId ?? '', executionId: input.executionId, events };
    input.onPresentationEvents?.(update);
    const publish = input.runtime?.publishTaskExecutionPresentationEvents;
    if (typeof publish === 'function') publish(update);
  };

  const persistPending = (): number => {
    // WHAT: Avoid ledger IO when the current batch contains no durable events.
    // WHY: Empty timer flushes must remain write-free.
    if (pendingEvents.size === 0) return 0;
    const events = [...pendingEvents.values()].sort((left, right) => left.line - right.line);
    const changed = persistCardSkillRunEvents({
      decisionOsRoot: input.decisionOsRoot,
      ledgerId: input.ledgerId,
      ledgerPath: input.ledgerPath,
      cardId: input.cardId,
      runId: input.runId,
      events,
      runtime: input.runtime,
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
        reportCodexBackgroundFailure(input.runtime ?? {}, 'persist-codex-output-events', error, {
          ledgerId: input.ledgerId ?? '',
          cardId: input.cardId,
          runId: input.runId,
        });
      }
    }, batchDelayMs);
  };

  const schedulePresentation = (): void => {
    if (presentationTimer || pendingPresentationEvents.size === 0) return;
    presentationTimer = setTimeout(() => {
      presentationTimer = undefined;
      try {
        publishPendingPresentation();
      } catch (error) {
        reportCodexBackgroundFailure(input.runtime ?? {}, 'publish-codex-presentation-events', error, {
          ledgerId: input.ledgerId ?? '',
          cardId: input.cardId,
          runId: input.runId,
          executionId: input.executionId,
        });
      }
    }, presentationBatchDelayMs);
    presentationTimer.unref?.();
  };
  const ingestText = (text: string): void => {
    const previousLength = remainder.length;
    remainder += text;
    let lineStart = 0;
    let newline = remainder.indexOf('\n', Math.min(newlineSearchOffset, previousLength));
    while (newline >= 0) {
      enqueueLine(remainder.slice(lineStart, newline));
      lineStart = newline + 1;
      newline = remainder.indexOf('\n', lineStart);
    }
    if (lineStart > 0) {
      remainder = remainder.slice(lineStart);
      newlineSearchOffset = Math.max(0, remainder.length - 1);
    } else {
      newlineSearchOffset = Math.max(0, remainder.length - 1);
    }
  };

  return {
    ingest(chunk) {
      ingestText(typeof chunk === 'string' ? chunk : decoder.write(chunk));
      schedulePersist();
      schedulePresentation();
    },
    flush() {
      // WHAT: Cancel the deferred batch before performing the settlement flush.
      // WHY: Process settlement must not race a later timer against the same pending events.
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (presentationTimer) {
        clearTimeout(presentationTimer);
        presentationTimer = undefined;
      }
      ingestText(decoder.end());
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
      const changed = persistPending();
      publishPendingPresentation();
      return changed;
    },
  };
}
