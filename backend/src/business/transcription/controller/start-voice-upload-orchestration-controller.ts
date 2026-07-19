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
import { readCardSkillRunController } from '../../codex/controller/read-card-skill-run-controller.js';
import { startThreadCodexProcessController } from '../../codex/controller/start-thread-codex-process-controller.js';
import { startCodexPipelineRunController } from '../../codex/controller/start-codex-pipeline-run-controller.js';
import { telemetry } from '@backend/telemetry/harness.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';

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
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as LedgerContext['ledger'];
  return { ok: true, decisionOsRoot, ledgerId: input.ledgerId, ledgerPath, ledger };
}

function writeLedger(context: LedgerContext, runtime: AnyRecord): void {
  persistLedgerProjection({ decisionOsRoot: context.decisionOsRoot, ledgerId: context.ledgerId, ledgerPath: context.ledgerPath, ledger: context.ledger, runtime });
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

function setQueuedVoiceExecution(input: {
  runtime: AnyRecord;
  ledgerId: string;
  cardId: string;
  transcribingBeforeLaunch: boolean;
  onLedgerChange?: unknown;
}): { ok: boolean; error?: string } {
  const observations = input.runtime.voiceCodexExecutionObservations && typeof input.runtime.voiceCodexExecutionObservations === 'object'
    ? input.runtime.voiceCodexExecutionObservations as Record<string, AnyRecord>
    : {};
  input.runtime.voiceCodexExecutionObservations = observations;
  const observationKey = `${input.ledgerId}\0${input.cardId}`;
  if (!input.transcribingBeforeLaunch) {
    delete observations[observationKey];
    telemetry('voice-codex-execution', { ledgerId: input.ledgerId, cardId: input.cardId, transcribingBeforeLaunch: false });
    notify(input.onLedgerChange, { reason: 'voice-codex-transcribing-before-launch-cleared', ledgerId: input.ledgerId, cardId: input.cardId });
    return { ok: true };
  }
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) return { ok: false, error: context.error };
  const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) return { ok: false, error: 'Thread target card not found.' };
  observations[observationKey] = { kind: 'voice-transcription', startedAt: new Date().toISOString() };
  telemetry('voice-codex-execution', { ledgerId: input.ledgerId, cardId: input.cardId, transcribingBeforeLaunch: true });
  notify(input.onLedgerChange, { reason: 'voice-codex-transcribing-before-launch', ledgerId: input.ledgerId, cardId: input.cardId });
  return { ok: true };
}

export function applyNotePatch(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  note: NonNullable<LedgerMutation['note']>;
  onCardContentChange?: unknown;
  reason: string;
}): { ok: boolean; error?: string; stale?: boolean } {
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) return { ok: false, error: context.error };
  hydrateLedgerThreadNotesFor(context.ledger, context.decisionOsRoot, input.threadId);
  const incomingRevision = Number(input.note.revision ?? 0);
  const currentNote = (normalizeLedgerNotes(context.ledger)[input.threadId] ?? []).find((note) => String(note.id ?? '') === String(input.note.id ?? ''));
  const currentRevision = Number(currentNote?.revision ?? 0);
  if (incomingRevision > 0 && currentRevision > incomingRevision) return { ok: false, stale: true, error: 'Stale voice note revision.' };
  const mutationResult = applyLedgerMutation({
    decisionOsRoot: context.decisionOsRoot,
    ledgerPath: context.ledgerPath,
    ledger: context.ledger,
    mutation: { action: 'update-note', note: { ...input.note, threadId: input.threadId } }
  });
  if (mutationResult.error) return { ok: false, error: String(mutationResult.error.body.error ?? 'Ledger mutation failed.') };
  writeLedger(context, input.runtime);
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
    status: String(note.status ?? ''),
    error: String(note.error ?? ''),
    revision: Number(note.revision ?? 0),
    transcriptionStartedAt: String(note.transcriptionStartedAt ?? ''),
    uploadReceivedAt: String(note.uploadReceivedAt ?? ''),
    audioPersistedAt: String(note.audioPersistedAt ?? ''),
    acceptedAt: String(note.acceptedAt ?? ''),
    providerStartedAt: String(note.providerStartedAt ?? ''),
    providerSettledAt: String(note.providerSettledAt ?? ''),
    completedAt: String(note.completedAt ?? '')
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

async function updateQueueStatus(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  noteId: string;
  status: string;
  runId?: string;
  error?: string;
  onCardContentChange?: unknown;
}): Promise<void> {
  applyNotePatch({
    runtime: input.runtime,
    ledgerId: input.ledgerId,
    threadId: input.threadId,
    note: {
      id: input.noteId,
      codexQueueStatus: input.status,
      codexQueueRunId: input.runId ?? '',
      codexQueueError: input.error ?? ''
    },
    onCardContentChange: input.onCardContentChange,
    reason: 'voice-codex-queue-status'
  });
}

export async function runQueuedThreadCodex(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  cardId: string;
  noteId: string;
  onCardContentChange?: unknown;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) {
    await updateQueueStatus({ ...input, status: 'failed', error: context.error ?? 'Ledger unavailable.' });
    return { ok: false, error: context.error };
  }
  const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (!card) {
    await updateQueueStatus({ ...input, status: 'failed', error: 'Thread target card not found.' });
    return { ok: false, error: 'Thread target card not found.' };
  }
  const runId = cardRunId(card);
  const selection = cardRunSelection(card);
  if (!runId) {
    await updateQueueStatus({ ...input, status: 'starting' });
    const result = await startThreadCodexProcessController({
      action_payload: { ledgerId: input.ledgerId, threadId: input.threadId, cardId: input.cardId, ...selection, disallowSkills: true, onLedgerChange: input.onLedgerChange },
      runtime_state: input.runtime
    });
    await updateQueueStatus({ ...input, status: result.ok === false ? 'failed' : 'started', runId: String((result.run as AnyRecord | undefined)?.id ?? ''), error: result.ok === false ? String(result.error ?? 'Codex launch failed.') : '' });
    return result;
  }

  const status = await readCardSkillRunController({
    action_payload: { ledgerId: input.ledgerId, cardId: input.cardId, runId, since: 0 },
    runtime_state: input.runtime
  });
  if (String(status.status ?? '') === 'running') {
    await updateQueueStatus({ ...input, status: 'waiting', runId });
    return { ok: true, queued: true, runId, status: 'waiting' };
  }
  await updateQueueStatus({ ...input, status: 'starting', runId });
  const result = await continueCardSkillRunController({
    action_payload: { ledgerId: input.ledgerId, cardId: input.cardId, runId, disallowSkills: true, onLedgerChange: input.onLedgerChange },
    runtime_state: input.runtime
  });
  await updateQueueStatus({ ...input, status: result.ok === false ? 'failed' : 'started', runId, error: result.ok === false ? String(result.error ?? 'Codex continue failed.') : '' });
  return result;
}

async function runQueuedVoicePipeline(input: {
  runtime: AnyRecord;
  ledgerId: string;
  threadId: string;
  cardId: string;
  noteId: string;
  pipelineId: string;
  onCardContentChange?: unknown;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  if (!input.pipelineId) {
    await updateQueueStatus({ ...input, status: 'failed', error: 'No voice pipeline is configured in Settings.' });
    return { ok: false, error: 'No voice pipeline is configured in Settings.' };
  }
  await updateQueueStatus({ ...input, status: 'starting' });
  const result = await startCodexPipelineRunController({
    action_payload: { ledgerId: input.ledgerId, sourceCardId: input.cardId, pipelineId: input.pipelineId, onLedgerChange: input.onLedgerChange },
    runtime_state: input.runtime
  });
  await updateQueueStatus({
    ...input,
    status: result.ok === false ? 'failed' : 'started',
    runId: String((result.run as AnyRecord | undefined)?.id ?? ''),
    error: result.ok === false ? String(result.error ?? 'Pipeline launch failed.') : ''
  });
  return result;
}

export async function continueQueuedVoiceCodexAfterRun(input: {
  runtime: AnyRecord;
  ledgerId: string;
  cardId: string;
  threadId?: string;
  runId: string;
  onCardContentChange?: unknown;
  onLedgerChange?: unknown;
}): Promise<AnyRecord> {
  const threadId = optionalText(input.threadId) || `thread-${input.cardId}`;
  const context = resolveLedgerContext({ runtime: input.runtime, ledgerId: input.ledgerId });
  if (!context.ok) return { ok: false, error: context.error };
  const waiting = (normalizeLedgerNotes(context.ledger)[threadId] ?? []).filter((note) => String(note.codexQueueStatus ?? '') === 'waiting');
  if (waiting.length === 0) return { ok: true, queued: false };
  for (const note of waiting) {
    await updateQueueStatus({ ...input, threadId, noteId: String(note.id ?? ''), status: 'starting', runId: input.runId });
  }
  const result = await continueCardSkillRunController({
    action_payload: { ledgerId: input.ledgerId, cardId: input.cardId, runId: input.runId, disallowSkills: true, onLedgerChange: input.onLedgerChange },
    runtime_state: input.runtime
  });
  for (const note of waiting) {
    await updateQueueStatus({
      ...input,
      threadId,
      noteId: String(note.id ?? ''),
      status: result.ok === false ? 'failed' : 'started',
      runId: input.runId,
      error: result.ok === false ? String(result.error ?? 'Codex continue failed.') : ''
    });
  }
  return result;
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
  audioBuffer: Buffer;
  mimeType: string;
  launchMode: VoiceLaunchMode;
  pipelineId: string;
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
    applyNotePatch({
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      threadId: input.threadId,
      note: {
        id: input.noteId,
        body: 'Voice uploaded.',
        voiceFileRef: input.voiceFileRef,
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
      applyNotePatch({
        runtime: input.runtime,
        ledgerId: input.ledgerId,
        threadId: input.threadId,
        note: { id: input.noteId, body: 'Finalizing transcript.', voiceFileRef: input.voiceFileRef, status: 'finalizing', providerSettledAt, revision: input.revisionBase + 2, error: '' },
        onCardContentChange: input.onCardContentChange,
        reason: 'voice-finalizing'
      });
      persistTranscribedText({ action_payload: { ...input.payload, text: input.runtime.transcriptionText }, runtime_state: input.runtime, data_model: input.data });
    }
  }
  const text = optionalText(input.runtime.transcriptionText);
  const completedAt = new Date().toISOString();
  if (config.ok !== false && transcription.ok !== false && text) {
    applyNotePatch({
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      threadId: input.threadId,
      note: {
        id: input.noteId,
        body: text,
        voiceFileRef: input.voiceFileRef,
        status: 'transcribed',
        providerSettledAt,
        completedAt,
        revision: input.revisionBase + 3,
        error: '',
        codexQueueStatus: input.launchMode !== 'send' ? input.cardId ? 'pending' : 'failed' : '',
        codexQueueError: input.launchMode !== 'send' && !input.cardId ? 'Thread target card not found.' : ''
      },
      onCardContentChange: input.onCardContentChange,
      reason: 'voice-transcribed'
    });
    lifecycleTelemetry({ noteId: input.noteId, phase: 'completed', at: completedAt, previousAt: providerSettledAt });
    if (input.launchMode !== 'send' && input.cardId) {
      if (input.launchMode === 'pipeline') await runQueuedVoicePipeline(input);
      else await runQueuedThreadCodex(input);
    }
    return;
  }
  const status = 'transcription failed';
  const error = String(transcription.error ?? status);
  applyNotePatch({
    runtime: input.runtime,
    ledgerId: input.ledgerId,
    threadId: input.threadId,
    note: {
      id: input.noteId,
      body: `Voice uploaded; ${status}.`,
      voiceFileRef: input.voiceFileRef,
      status,
      providerSettledAt,
      completedAt,
      revision: config.ok === false ? input.revisionBase + 1 : input.revisionBase + 2,
      error,
      codexQueueStatus: input.launchMode !== 'send' ? 'failed' : '',
      codexQueueError: input.launchMode !== 'send' ? error : ''
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
  const uploadReceivedAt = new Date().toISOString();
  lifecycleTelemetry({ noteId: id, phase: 'upload-received', at: uploadReceivedAt });
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!audioBuffer?.byteLength) return { ok: false, statusCode: 400, error: 'No audio was uploaded.' };
  const mimeType = String(payload.mimeType ?? 'audio/webm');
  const upload = persistUploadedVoiceAudio({ action_payload: { ...payload, audioBuffer, mimeType, threadId }, runtime_state: runtime, data_model: data });
  if (upload.ok === false || !upload.voiceFileRef) return { ok: false, statusCode: 400, error: upload.error ?? 'Voice upload failed.' };
  const voiceFileRef = String(upload.voiceFileRef);
  const audioPersistedAt = new Date().toISOString();
  lifecycleTelemetry({ noteId: id, phase: 'audio-persisted', at: audioPersistedAt, previousAt: uploadReceivedAt });
  if (!ledgerId || !threadId) {
    return { ok: false, statusCode: 400, uploaded: true, configured: true, noteId: id, voiceFileRef, error: 'Missing ledgerId or threadId.' };
  }
  const launchMode = voiceLaunchMode(payload);
  const queueCodex = launchMode !== 'send';
  const acceptedAt = new Date().toISOString();
  const patch = applyNotePatch({
    runtime,
    ledgerId,
    threadId,
    note: {
      id,
      body: 'Voice uploaded.',
      voiceFileRef,
      status: 'queued',
      uploadReceivedAt,
      audioPersistedAt,
      acceptedAt,
      revision: 1,
      error: '',
      codexQueueStatus: queueCodex ? 'requested' : '',
      codexQueueRequestedAt: queueCodex ? acceptedAt : ''
    },
    onCardContentChange: payload.onCardContentChange,
    reason: 'voice-uploaded'
  });
  if (!patch.ok) return { ok: false, statusCode: 500, uploaded: true, configured: true, noteId: id, voiceFileRef, error: patch.error ?? 'Voice note commit failed.' };
  if (queueCodex && cardId) {
    const execution = setQueuedVoiceExecution({ runtime, ledgerId, cardId, transcribingBeforeLaunch: true, onLedgerChange: payload.onLedgerChange });
    if (!execution.ok) {
      return { ok: false, statusCode: 404, uploaded: true, configured: true, noteId: id, voiceFileRef, error: execution.error ?? 'Thread target card not found.' };
    }
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
    audioBuffer,
    mimeType,
    launchMode,
    pipelineId: optionalText(payload.voicePipelineId),
    uploadReceivedAt,
    audioPersistedAt,
    acceptedAt,
    revisionBase: 1,
    onCardContentChange: payload.onCardContentChange,
    onLedgerChange: payload.onLedgerChange
  }).catch((error) => {
    applyNotePatch({
      runtime,
      ledgerId,
      threadId,
      note: {
        id,
        body: 'Voice uploaded; transcription failed.',
        voiceFileRef,
        status: 'transcription failed',
        completedAt: new Date().toISOString(),
        revision: 4,
        error: error instanceof Error ? error.message : String(error),
        codexQueueStatus: queueCodex ? 'failed' : '',
        codexQueueError: queueCodex ? error instanceof Error ? error.message : String(error) : ''
      },
      onCardContentChange: payload.onCardContentChange,
      reason: 'voice-orchestration-failed'
    });
  }).finally(() => {
    if (queueCodex && cardId) {
      setQueuedVoiceExecution({ runtime, ledgerId, cardId, transcribingBeforeLaunch: false, onLedgerChange: payload.onLedgerChange });
    }
  });
  if (bool(payload.awaitCompletion)) await completion;
  return { ok: true, statusCode: 202, uploaded: true, configured: true, noteId: id, voiceFileRef, status: 'queued', revision: 1, uploadReceivedAt, audioPersistedAt, acceptedAt, queueCodex, launchMode };
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
  const launchMode = voiceLaunchMode(payload);
  const cardId = cardIdForThread(threadId, payload.cardId);
  const patch = applyNotePatch({
    runtime,
    ledgerId,
    threadId,
    note: {
      id,
      body: 'Voice uploaded.',
      voiceFileRef,
      status: 'queued',
      uploadReceivedAt,
      audioPersistedAt,
      acceptedAt,
      revision: revisionBase,
      error: ''
    },
    onCardContentChange: payload.onCardContentChange,
    reason: 'voice-retry-queued'
  });
  if (!patch.ok) return { ok: false, statusCode: patch.stale ? 409 : 500, error: patch.error };
  const completion = finishVoiceUploadOrchestration({
    payload,
    runtime,
    data,
    ledgerId,
    threadId,
    cardId,
    noteId: id,
    voiceFileRef,
    audioBuffer: loaded.audioBuffer as Buffer,
    mimeType: String(loaded.mimeType ?? 'audio/webm'),
    launchMode,
    pipelineId: optionalText(payload.voicePipelineId),
    uploadReceivedAt,
    audioPersistedAt,
    acceptedAt,
    revisionBase,
    onCardContentChange: payload.onCardContentChange,
    onLedgerChange: payload.onLedgerChange
  }).catch(() => undefined);
  if (bool(payload.awaitCompletion)) await completion;
  return { ok: true, statusCode: 202, uploaded: true, configured: true, noteId: id, voiceFileRef, status: 'queued', revision: revisionBase, uploadReceivedAt, audioPersistedAt, acceptedAt };
}
