/**
 * WHAT: Owns voice upload, transcription, thread note updates, and optional Codex queueing.
 * WHY: The browser should issue one upload command while the backend preserves ordering.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyLedgerMutation, type LedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { hydrateLedgerThreadNotesFor, stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { callOpenaiTranscription } from '@backend/business/transcription/effect/call-openai-transcription.js';
import { persistUploadedVoiceAudio } from '@backend/business/transcription/effect/persist-uploaded-voice-audio.js';
import { loadUploadedVoiceAudio } from '@backend/business/transcription/effect/load-uploaded-voice-audio.js';
import { persistTranscribedText } from '@backend/business/transcription/effect/persist-transcribed-text.js';
import { resolveTranscriptionConfig } from '@backend/business/transcription/helper/resolve-transcription-config.js';
import { continueCardSkillRunController } from '../../codex/controller/continue-card-skill-run-controller.js';
import { startThreadCodexProcessController } from '../../codex/controller/start-thread-codex-process-controller.js';
import { startCodexPipelineRunController } from '../../codex/controller/start-codex-pipeline-run-controller.js';
import { telemetry } from '@backend/telemetry/harness.js';
import { readLedgerProjection } from '../../task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;
export const voiceTranscriptionDeadlineMs = 120_000;

type LedgerContext = {
  ok: boolean;
  error?: string;
  statusCode?: number;
  decisionOsRoot: string;
  ledgerId: string;
  ledgerPath: string;
  ledger: AnyRecord & {
    cards?: AnyRecord[];
    notes?: Record<string, AnyRecord[]>;
    threadFiles?: Record<string, string>;
  };
};

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function bool(value: unknown): boolean {
  return value === true || String(value ?? '').toLowerCase() === 'true' || String(value ?? '') === '1';
}

type VoiceLaunchMode = 'send' | 'run' | 'pipeline';

function voiceLaunchMode(payload: AnyRecord): VoiceLaunchMode {
  const mode = optionalText(payload.launchMode);
  if (mode === 'run' || mode === 'pipeline') return mode;
  return bool(payload.queueCodex) ? 'run' : 'send';
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function noteId(value: unknown): string {
  const text = optionalText(value);
  return text || `note-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function cardIdForThread(threadId: string, cardId: unknown): string {
  const explicit = optionalText(cardId);
  if (explicit) return explicit;
  return threadId.startsWith('thread-') ? threadId.replace(/^thread-/, '').trim() : '';
}

function resolveLedgerContext(input: { runtime: AnyRecord; ledgerId: string }): LedgerContext {
  const decisionOsRoot = resolve(String(input.runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true }, runtime_state: input.runtime });
  const tab = state.ledgers.find((entry) => entry.id === input.ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', decisionOsRoot, ledgerId: input.ledgerId, ledgerPath: '', ledger: {} };
  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', decisionOsRoot, ledgerId: input.ledgerId, ledgerPath, ledger: {} };
  const ledger = readLedgerProjection({ ledgerId: input.ledgerId, ledgerPath, runtime: input.runtime }) as LedgerContext['ledger'];
  return { ok: true, decisionOsRoot, ledgerId: input.ledgerId, ledgerPath, ledger };
}

function writeLedger(context: LedgerContext): void {
  stripHydratedThreadNotes(context.ledger);
  // Task thread Markdown was already durably written by the mutation. Its structural projection is a separate authority.
  if (context.ledgerId !== 'tasks') writeFileSync(context.ledgerPath, JSON.stringify(context.ledger, null, 2));
}

function notify(callback: unknown, event: AnyRecord): void {
  if (typeof callback === 'function') callback(event);
}

function notifyThreadChange(context: LedgerContext, threadId: string, callback: unknown, reason: string, note: AnyRecord = {}): void {
  const contentFile = String(context.ledger.threadFiles?.[threadId] ?? '');
  notify(callback, {
    reason,
    kind: 'thread-content',
    ledgerId: context.ledgerId,
    threadId,
    contentFile,
    noteId: String(note.id ?? ''),
    status: String(note.status ?? ''),
    revision: Number(note.revision ?? 0)
  });
}

export async function applyNotePatch(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  mutationId?: string;
  note: NonNullable<LedgerMutation['note']>;
  onCardContentChange?: unknown;
  reason: string;
}): Promise<{
  ok: boolean;
  error?: string;
  stale?: boolean;
  statusCode?: number;
  taskClock?: Record<string, number>;
  receipt?: Record<string, unknown>;
}> {
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) return { ok: false, error: context.error };
  hydrateLedgerThreadNotesFor(context.ledger, context.decisionOsRoot, input.threadId);
  const mutation = {
    action: 'update-note',
    ...(input.mutationId ? { mutationId: input.mutationId } : {}),
    note: { ...input.note, threadId: input.threadId },
  } satisfies LedgerMutation;
  const persistTaskMutation = input.runtime.persistTaskLedgerMutation;
  if (context.ledgerId === 'tasks' && typeof persistTaskMutation === 'function') {
    try {
      const committed = await persistTaskMutation(mutation) as AnyRecord;
      notifyThreadChange(context, input.threadId, input.onCardContentChange, input.reason, input.note as AnyRecord);
      return {
        ok: true,
        ...(committed.taskClock && typeof committed.taskClock === 'object' ? { taskClock: committed.taskClock as Record<string, number> } : {}),
        ...(committed.receipt && typeof committed.receipt === 'object' ? { receipt: committed.receipt as Record<string, unknown> } : {}),
      };
    } catch (error) {
      const statusCode = Number((error as { statusCode?: unknown } | null)?.statusCode ?? 0);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(statusCode === 409 || statusCode === 503 ? { statusCode, stale: statusCode === 409 } : {}),
      };
    }
  } else {
    const mutationResult = applyLedgerMutation({
      decisionOsRoot: context.decisionOsRoot,
      ledgerPath: context.ledgerPath,
      ledger: context.ledger,
      mutation
    });
    if (mutationResult.error) {
      return {
        ok: false,
        error: String(mutationResult.error.body.error ?? 'Ledger mutation failed.'),
        statusCode: mutationResult.error.statusCode,
        stale: mutationResult.error.statusCode === 409,
      };
    }
    writeLedger(context);
  }
  notifyThreadChange(context, input.threadId, input.onCardContentChange, input.reason, input.note as AnyRecord);
  return { ok: true };
}

function lifecycleTelemetry(input: { noteId: string; phase: string; at: string; previousAt?: string }): void {
  const previous = input.previousAt ? Date.parse(input.previousAt) : NaN;
  const current = Date.parse(input.at);
  telemetry('voice-transcription-lifecycle', {
    noteId: input.noteId,
    phase: input.phase,
    at: input.at,
    durationMs: Number.isFinite(previous) && Number.isFinite(current) ? Math.max(0, current - previous) : 0
  });
}

function voiceStatusPayload(note: AnyRecord): AnyRecord {
  return {
    id: String(note.id ?? ''),
    message: String(note.message ?? note.body ?? ''),
    voiceFileRef: String(note.voiceFileRef ?? ''),
    voiceAttemptId: String(note.voiceAttemptId ?? ''),
    status: String(note.status ?? ''),
    error: String(note.error ?? ''),
    revision: Number(note.revision ?? 0),
    transcriptionStartedAt: String(note.transcriptionStartedAt ?? ''),
    uploadReceivedAt: String(note.uploadReceivedAt ?? ''),
    audioPersistedAt: String(note.audioPersistedAt ?? ''),
    acceptedAt: String(note.acceptedAt ?? ''),
    providerStartedAt: String(note.providerStartedAt ?? ''),
    providerSettledAt: String(note.providerSettledAt ?? ''),
    completedAt: String(note.completedAt ?? ''),
    codexQueueRequestId: String(note.codexQueueRequestId ?? ''),
    codexQueueLaunchMode: String(note.codexQueueLaunchMode ?? ''),
    codexQueueCardId: String(note.codexQueueCardId ?? ''),
    codexQueuePipelineId: String(note.codexQueuePipelineId ?? ''),
  };
}

export function readVoiceTranscriptionStatusController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord } | AnyRecord = {}): AnyRecord {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const ledgerId = optionalText(payload.ledgerId);
  const threadId = optionalText(payload.threadId);
  const id = optionalText(payload.noteId);
  if (!ledgerId || !threadId || !id) return { ok: false, statusCode: 400, error: 'ledgerId, threadId, and noteId are required.' };
  const context = resolveLedgerContext({ runtime, ledgerId });
  if (!context.ok) return { ok: false, statusCode: context.statusCode ?? 404, error: context.error };
  hydrateLedgerThreadNotesFor(context.ledger, context.decisionOsRoot, threadId);
  const notes = normalizeLedgerNotes(context.ledger)[threadId];
  if (!Array.isArray(notes)) return { ok: false, statusCode: 404, error: 'Thread not found.' };
  const note = notes.find((entry) => String(entry.id ?? '') === id);
  if (!note) return { ok: false, statusCode: 404, error: 'Voice note not found.' };
  return { ok: true, statusCode: 200, note: voiceStatusPayload(note) };
}

function cardRunId(card: AnyRecord | undefined): string {
  return optionalText(card?.codexThreadRunId) || optionalText(card?.codexRunId);
}

function cardRunSelection(card: AnyRecord | undefined): { codexModel: string; codexEffort: string } {
  return {
    codexModel: optionalText(card?.codexRunModel),
    codexEffort: optionalText(card?.codexRunEffort),
  };
}

export async function runQueuedThreadCodex(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  cardId: string;
  noteId: string;
  executionId: string;
  sessionId: string;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) return { ok: false, error: context.error };
  const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) return { ok: false, error: 'Thread target card not found.' };
  const runId = cardRunId(card);
  const selection = cardRunSelection(card);
  if (!runId) {
    return startThreadCodexProcessController({
      action_payload: {
        requestId: `voice:${input.noteId}`,
        ledgerId: input.ledgerId,
        threadId: input.threadId,
        cardId: input.cardId,
        reservedRunId: input.sessionId,
        executionId: input.executionId,
        ...selection,
        disallowSkills: true,
        onLedgerChange: input.onLedgerChange,
      },
      runtime_state: input.runtime
    });
  }
  return continueCardSkillRunController({
    action_payload: {
      requestId: `voice:${input.noteId}`,
      ledgerId: input.ledgerId,
      cardId: input.cardId,
      runId,
      executionId: input.executionId,
      disallowSkills: true,
      onLedgerChange: input.onLedgerChange,
    },
    runtime_state: input.runtime
  });
}

async function runQueuedVoicePipeline(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  cardId: string;
  noteId: string;
  pipelineId: string;
  executionId: string;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  if (!input.pipelineId) return { ok: false, error: 'No voice pipeline is configured in Settings.' };
  return startCodexPipelineRunController({
    action_payload: {
      requestId: `voice:${input.noteId}`,
      executionId: input.executionId,
      reservedPipelineRunId: `voice-pipeline-${input.noteId}`,
      ledgerId: input.ledgerId,
      sourceCardId: input.cardId,
      pipelineId: input.pipelineId,
      onLedgerChange: input.onLedgerChange,
    },
    runtime_state: input.runtime
  });
}

async function finishVoiceUploadOrchestration(input: {
  payload: AnyRecord;
  runtime: AnyRecord;
  data: AnyRecord;
  ledgerId: string;
  threadId: string;
  cardId: string;
  noteId: string;
  voiceFileRef: string;
  voiceAttemptId: string;
  audioBuffer: Buffer;
  mimeType: string;
  launchMode: VoiceLaunchMode;
  pipelineId: string;
  executionId: string;
  sessionId: string;
  onCardContentChange?: unknown;
  onLedgerChange?: unknown;
  uploadReceivedAt: string;
  audioPersistedAt: string;
  acceptedAt: string;
  revisionBase: number;
}): Promise<void> {
  const config = resolveTranscriptionConfig({ action_payload: input.payload, runtime_state: input.runtime, data_model: input.data });
  let transcription: AnyRecord = { ok: false, error: 'transcription not configured' };
  let providerStartedAt = '';
  let providerSettledAt = '';
  if (config.ok !== false) {
    providerStartedAt = new Date().toISOString();
    lifecycleTelemetry({ noteId: input.noteId, phase: 'provider-started', at: providerStartedAt, previousAt: input.acceptedAt });
    const transcriptionPatch = await applyNotePatch({
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      threadId: input.threadId,
      note: {
        id: input.noteId,
        body: 'Voice uploaded.',
        voiceFileRef: input.voiceFileRef,
        voiceAttemptId: input.voiceAttemptId,
        status: 'transcribing',
        transcriptionStartedAt: providerStartedAt,
        uploadReceivedAt: input.uploadReceivedAt,
        audioPersistedAt: input.audioPersistedAt,
        acceptedAt: input.acceptedAt,
        providerStartedAt,
        revision: input.revisionBase + 1,
        error: ''
      },
      onCardContentChange: input.onCardContentChange,
      reason: 'voice-transcribing'
    });
    if (!transcriptionPatch.ok) return;
    const controller = new AbortController();
    const deadlineMs = Math.max(1, Number(input.payload.transcriptionDeadlineMs ?? voiceTranscriptionDeadlineMs));
    const deadline = setTimeout(() => controller.abort(new Error(`Transcription timed out after ${deadlineMs}ms.`)), deadlineMs);
    transcription = await callOpenaiTranscription({
      action_payload: { ...input.payload, config, audioBuffer: input.audioBuffer, mimeType: input.mimeType, signal: controller.signal },
      runtime_state: input.runtime,
      data_model: input.data
    }).catch((error) => ({ ok: false, error: controller.signal.aborted ? `Transcription timed out after ${deadlineMs}ms.` : error instanceof Error ? error.message : String(error) }));
    clearTimeout(deadline);
    providerSettledAt = new Date().toISOString();
    lifecycleTelemetry({ noteId: input.noteId, phase: 'provider-settled', at: providerSettledAt, previousAt: providerStartedAt });
    if (transcription.ok !== false) {
      await applyNotePatch({
        runtime: input.runtime,
        ledgerId: input.ledgerId,
        threadId: input.threadId,
        note: { id: input.noteId, body: 'Finalizing transcript.', voiceFileRef: input.voiceFileRef, voiceAttemptId: input.voiceAttemptId, status: 'finalizing', providerSettledAt, revision: input.revisionBase + 2, error: '' },
        onCardContentChange: input.onCardContentChange,
        reason: 'voice-finalizing'
      });
      persistTranscribedText({ action_payload: { ...input.payload, text: input.runtime.transcriptionText }, runtime_state: input.runtime, data_model: input.data });
    }
  }
  const text = optionalText(input.runtime.transcriptionText);
  const completedAt = new Date().toISOString();
  if (config.ok !== false && transcription.ok !== false && text) {
    const transcriptPatch = await applyNotePatch({
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      threadId: input.threadId,
      note: {
        id: input.noteId,
        body: text,
        voiceFileRef: input.voiceFileRef,
        voiceAttemptId: input.voiceAttemptId,
        status: 'transcribed',
        providerSettledAt,
        completedAt,
        revision: input.revisionBase + 3,
        error: '',
        codexQueueRequestId: input.launchMode !== 'send' ? `voice:${input.noteId}` : '',
        codexQueueLaunchMode: input.launchMode !== 'send' ? input.launchMode : '',
        codexQueueCardId: input.launchMode !== 'send' ? input.cardId : '',
        codexQueuePipelineId: input.launchMode === 'pipeline' ? input.pipelineId : ''
      },
      onCardContentChange: input.onCardContentChange,
      reason: 'voice-transcribed'
    });
    if (!transcriptPatch.ok) return;
    lifecycleTelemetry({ noteId: input.noteId, phase: 'completed', at: completedAt, previousAt: providerSettledAt });
    if (input.launchMode !== 'send' && input.cardId) {
      const result = input.launchMode === 'pipeline' ? await runQueuedVoicePipeline(input) : await runQueuedThreadCodex(input);
      if (result.ok === false) {
        // WHAT: Persist the post-transcription launch failure without discarding retry inputs.
        // WHY: A transcript is complete evidence even when its assigned execution owner is unavailable.
        await applyNotePatch({
          runtime: input.runtime,
          ledgerId: input.ledgerId,
          threadId: input.threadId,
          note: {
            id: input.noteId,
            body: text,
            voiceFileRef: input.voiceFileRef,
            voiceAttemptId: input.voiceAttemptId,
            status: 'execution launch failed',
            providerSettledAt,
            completedAt,
            revision: input.revisionBase + 4,
            error: String(result.error ?? 'execution_launch_failed'),
            codexQueueRequestId: `voice:${input.noteId}`,
            codexQueueLaunchMode: input.launchMode,
            codexQueueCardId: input.cardId,
            codexQueuePipelineId: input.launchMode === 'pipeline' ? input.pipelineId : ''
          },
          onCardContentChange: input.onCardContentChange,
          reason: 'voice-execution-launch-failed'
        });
        return;
      }
    }
    return;
  }
  const status = 'transcription failed';
  const error = String(transcription.error ?? status);
  await applyNotePatch({
    runtime: input.runtime,
    ledgerId: input.ledgerId,
    threadId: input.threadId,
    note: {
      id: input.noteId,
      body: `Voice uploaded; ${status}.`,
      voiceFileRef: input.voiceFileRef,
      voiceAttemptId: input.voiceAttemptId,
      status,
      providerSettledAt,
      completedAt,
      revision: config.ok === false ? input.revisionBase + 1 : input.revisionBase + 2,
      error
    },
    onCardContentChange: input.onCardContentChange,
    reason: 'voice-transcription-failed'
  });
  lifecycleTelemetry({ noteId: input.noteId, phase: 'failed', at: completedAt, previousAt: providerSettledAt || input.acceptedAt });
}

export async function startVoiceUploadOrchestrationController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const ledgerId = optionalText(payload.ledgerId);
  const threadId = optionalText(payload.threadId) || 'conversation-ledger';
  const cardId = cardIdForThread(threadId, payload.cardId);
  const id = noteId(payload.noteId);
  const voiceAttemptId = optionalText(payload.voiceAttemptId) || `voice-attempt-${randomUUID()}`;
  const mutationId = optionalText(payload.mutationId) || `voice-upload:${id}:${voiceAttemptId}`;
  const uploadReceivedAt = new Date().toISOString();
  lifecycleTelemetry({ noteId: id, phase: 'upload-received', at: uploadReceivedAt });
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!audioBuffer?.byteLength) return { ok: false, statusCode: 400, error: 'No audio was uploaded.' };
  const mimeType = String(payload.mimeType ?? 'audio/webm');
  const upload = persistUploadedVoiceAudio({
    action_payload: { ...payload, noteId: id, voiceAttemptId, audioBuffer, mimeType, threadId },
    runtime_state: runtime,
    data_model: data,
  });
  if (upload.ok === false || !upload.voiceFileRef) return { ok: false, statusCode: 400, error: upload.error ?? 'Voice upload failed.' };
  const voiceFileRef = String(upload.voiceFileRef);
  const audioPersistedAt = new Date().toISOString();
  lifecycleTelemetry({ noteId: id, phase: 'audio-persisted', at: audioPersistedAt, previousAt: uploadReceivedAt });
  if (!ledgerId || !threadId) {
    return { ok: false, statusCode: 400, uploaded: true, configured: true, noteId: id, voiceFileRef, error: 'Missing ledgerId or threadId.' };
  }
  const launchMode = voiceLaunchMode(payload);
  const queueCodex = launchMode !== 'send';
  const executionId = queueCodex ? optionalText(payload.executionId) || `voice-execution-${id}` : '';
  let executionSessionId = '';
  const acceptedAt = new Date().toISOString();
  const reviewContext = (() => {
    try {
      const parsed = JSON.parse(String(payload.reviewContext ?? ''));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : undefined;
    } catch { return undefined; }
  })();
  const patch = await applyNotePatch({
    runtime,
    ledgerId,
    threadId,
    mutationId,
    note: {
      id,
      body: 'Voice uploaded.',
      voiceFileRef,
      voiceAttemptId,
      reviewContext,
      status: 'queued',
      uploadReceivedAt,
      audioPersistedAt,
      acceptedAt,
      revision: 1,
      error: '',
      codexQueueRequestId: queueCodex ? `voice:${id}` : '',
      codexQueueLaunchMode: queueCodex ? launchMode : '',
      codexQueueCardId: queueCodex ? cardId : '',
      codexQueuePipelineId: launchMode === 'pipeline' ? optionalText(payload.voicePipelineId) : '',
    },
    onCardContentChange: payload.onCardContentChange,
    reason: 'voice-uploaded'
  });
  if (!patch.ok) return { ok: false, statusCode: patch.statusCode ?? 500, uploaded: true, configured: true, noteId: id, voiceFileRef, error: patch.error ?? 'Voice note commit failed.' };
  if (queueCodex && cardId) {
    const context = resolveLedgerContext({ runtime, ledgerId });
    if (!context.ok) return { ok: false, statusCode: 404, uploaded: true, configured: true, noteId: id, voiceFileRef, error: context.error ?? 'Thread target card not found.' };
    const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
    if (!card) return { ok: false, statusCode: 404, uploaded: true, configured: true, noteId: id, voiceFileRef, error: 'Thread target card not found.' };
    executionSessionId = cardRunId(card) || (launchMode === 'pipeline' ? `voice-preparation-${id}` : `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`);
  }
  lifecycleTelemetry({ noteId: id, phase: 'accepted', at: acceptedAt, previousAt: audioPersistedAt });
  const completion = finishVoiceUploadOrchestration({
    payload,
    runtime,
    data,
    ledgerId,
    threadId,
    cardId,
    noteId: id,
    voiceFileRef,
    voiceAttemptId,
    audioBuffer,
    mimeType,
    launchMode,
    pipelineId: optionalText(payload.voicePipelineId),
    executionId,
    sessionId: executionSessionId,
    uploadReceivedAt,
    audioPersistedAt,
    acceptedAt,
    revisionBase: 1,
    onCardContentChange: payload.onCardContentChange,
    onLedgerChange: payload.onLedgerChange
  }).catch(async (error) => {
    await applyNotePatch({
      runtime,
      ledgerId,
      threadId,
      note: {
        id,
        body: 'Voice uploaded; transcription failed.',
        voiceFileRef,
        voiceAttemptId,
        status: 'transcription failed',
        completedAt: new Date().toISOString(),
        revision: 4,
        error: error instanceof Error ? error.message : String(error)
      },
      onCardContentChange: payload.onCardContentChange,
      reason: 'voice-orchestration-failed'
    });
  });
  if (bool(payload.awaitCompletion)) await completion;
  return {
    ok: true,
    statusCode: 202,
    uploaded: true,
    configured: true,
    noteId: id,
    voiceFileRef,
    voiceAttemptId,
    status: 'queued',
    revision: 1,
    uploadReceivedAt,
    audioPersistedAt,
    acceptedAt,
    queueCodex,
    launchMode,
    executionId,
    taskClock: patch.taskClock,
    receipt: patch.receipt,
  };
}

export async function startVoiceRetryOrchestrationController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const ledgerId = optionalText(payload.ledgerId);
  const threadId = optionalText(payload.threadId);
  const id = optionalText(payload.noteId);
  const voiceFileRef = optionalText(payload.voiceFileRef);
  if (!ledgerId || !threadId || !id || !voiceFileRef) return { ok: false, statusCode: 400, error: 'ledgerId, threadId, noteId, and voiceFileRef are required.' };
  const status = readVoiceTranscriptionStatusController({ action_payload: { ledgerId, threadId, noteId: id }, runtime_state: runtime });
  if (status.ok === false) return status;
  const current = status.note as AnyRecord;
  if (String(current.voiceFileRef ?? '') !== voiceFileRef) return { ok: false, statusCode: 409, error: 'Voice file does not match the persisted note.' };
  const loaded = loadUploadedVoiceAudio({ action_payload: { ...payload, voiceFileRef }, runtime_state: runtime, data_model: data });
  if (loaded.ok === false || !(loaded.audioBuffer as Buffer | undefined)?.byteLength) return { ok: false, statusCode: 404, error: loaded.error ?? 'Voice upload not found.' };
  const uploadReceivedAt = new Date().toISOString();
  const audioPersistedAt = uploadReceivedAt;
  const acceptedAt = new Date().toISOString();
  const revisionBase = Number(current.revision ?? 0) + 1;
  const voiceAttemptId = `voice-attempt-${randomUUID()}`;
  const persistedLaunchMode = optionalText(current.codexQueueLaunchMode);
  const launchMode = persistedLaunchMode === 'run' || persistedLaunchMode === 'pipeline'
    ? persistedLaunchMode
    : voiceLaunchMode(payload);
  const cardId = optionalText(current.codexQueueCardId) || cardIdForThread(threadId, payload.cardId);
  const queueCodex = launchMode !== 'send';
  const executionId = queueCodex ? optionalText(payload.executionId) || `voice-execution-${id}` : '';
  let executionSessionId = '';
  const patch = await applyNotePatch({
    runtime,
    ledgerId,
    threadId,
    note: {
      id,
      body: 'Voice uploaded.',
      voiceFileRef,
      voiceAttemptId,
      status: 'queued',
      uploadReceivedAt,
      audioPersistedAt,
      acceptedAt,
      revision: revisionBase,
      error: '',
      codexQueueRequestId: queueCodex ? optionalText(current.codexQueueRequestId) || `voice:${id}` : '',
      codexQueueLaunchMode: queueCodex ? launchMode : '',
      codexQueueCardId: queueCodex ? cardId : '',
      codexQueuePipelineId: launchMode === 'pipeline'
        ? optionalText(current.codexQueuePipelineId) || optionalText(payload.voicePipelineId)
        : '',
    },
    onCardContentChange: payload.onCardContentChange,
    reason: 'voice-retry-queued'
  });
  if (!patch.ok) return { ok: false, statusCode: patch.statusCode ?? (patch.stale ? 409 : 500), error: patch.error };
  if (queueCodex && cardId) {
    const context = resolveLedgerContext({ runtime, ledgerId });
    if (!context.ok) return { ok: false, statusCode: 404, error: context.error ?? 'Thread target card not found.' };
    const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
    if (!card) return { ok: false, statusCode: 404, error: 'Thread target card not found.' };
    executionSessionId = cardRunId(card) || (launchMode === 'pipeline' ? `voice-preparation-${id}` : `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`);
  }
  const completion = finishVoiceUploadOrchestration({
    payload,
    runtime,
    data,
    ledgerId,
    threadId,
    cardId,
    noteId: id,
    voiceFileRef,
    voiceAttemptId,
    audioBuffer: loaded.audioBuffer as Buffer,
    mimeType: String(loaded.mimeType ?? 'audio/webm'),
    launchMode,
    pipelineId: optionalText(current.codexQueuePipelineId) || optionalText(payload.voicePipelineId),
    executionId,
    sessionId: executionSessionId,
    uploadReceivedAt,
    audioPersistedAt,
    acceptedAt,
    revisionBase,
    onCardContentChange: payload.onCardContentChange,
    onLedgerChange: payload.onLedgerChange
  }).catch(() => undefined);
  if (bool(payload.awaitCompletion)) await completion;
  return { ok: true, statusCode: 202, uploaded: true, configured: true, noteId: id, voiceFileRef, voiceAttemptId, status: 'queued', revision: revisionBase, uploadReceivedAt, audioPersistedAt, acceptedAt, executionId };
}
