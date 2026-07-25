export const voiceTranscriptionDeadlineMs = 120_000;

const terminalStatuses = new Set(['transcribed', 'transcription failed', 'execution launch failed']);
const statusRank: Record<string, number> = {
  uploading: 0,
  queued: 1,
  transcribing: 2,
  finalizing: 3,
  transcribed: 4,
  'transcription failed': 4,
  'execution launch failed': 4
};

export const voiceLifecycleFields = [
  'message',
  'voiceFileRef',
  'status',
  'error',
  'transcriptionStartedAt',
  'uploadReceivedAt',
  'audioPersistedAt',
  'acceptedAt',
  'providerStartedAt',
  'providerSettledAt',
  'completedAt'
] as const;

export function isTerminalVoiceStatus(status: unknown): boolean {
  return terminalStatuses.has(String(status ?? '').toLowerCase());
}

export function isPendingVoiceNote(note: Record<string, unknown>): boolean {
  return Boolean(note.voiceFileRef) && !isTerminalVoiceStatus(note.status) && ['queued', 'transcribing', 'finalizing'].includes(String(note.status ?? '').toLowerCase());
}

export function voicePhaseLabel(status: unknown): string {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'uploading') return 'Uploading audio';
  if (normalized === 'queued') return 'Waiting for transcription';
  if (normalized === 'transcribing') return 'Transcribing';
  if (normalized === 'finalizing') return 'Finalizing transcript';
  if (normalized === 'transcribed') return 'Transcribed';
  if (normalized === 'transcription failed') return 'Transcription failed';
  if (normalized === 'execution launch failed') return 'Execution launch failed';
  return String(status ?? '');
}

export function voicePhaseStartedAt(note: Record<string, unknown>): string {
  const status = String(note.status ?? '').toLowerCase();
  if (status === 'uploading') return String(note.uploadReceivedAt ?? note.timestamp ?? '');
  if (status === 'queued') return String(note.acceptedAt ?? note.audioPersistedAt ?? '');
  if (status === 'transcribing') return String(note.providerStartedAt ?? note.transcriptionStartedAt ?? '');
  if (status === 'finalizing') return String(note.providerSettledAt ?? '');
  return '';
}

export function voicePhaseElapsedSeconds(note: Record<string, unknown>, now = Date.now()): number | null {
  const startedAt = Date.parse(voicePhaseStartedAt(note));
  return Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
}

export function shouldApplyVoiceServerNote(local: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const localRevision = Number(local.revision ?? 0);
  const incomingRevision = Number(incoming.revision ?? 0);
  const localStatus = String(local.status ?? '').toLowerCase();
  const incomingStatus = String(incoming.status ?? '').toLowerCase();
  // WHAT: Keep a completed local lifecycle terminal even when a delayed relay snapshot has a larger revision.
  // WHY: Replica counters order contributions; they do not authorize a backwards domain transition.
  if (!shouldAcceptReplicatedTaskState({
    domain: 'voice',
    local,
    incoming,
    pendingReceipt: null,
    source: 'relay-refresh',
  })) return false;
  const localRank = statusRank[localStatus] ?? -1;
  const incomingRank = statusRank[incomingStatus] ?? -1;
  // WHAT: Enforce declared forward voice transitions independently from replica revision order.
  // WHY: A larger relay counter cannot authorize finalizing-to-queued or transcribing-to-uploading regression.
  if (incomingRank < localRank) return false;
  if (incomingRevision > localRevision) return true;
  if (incomingRevision < localRevision) return false;
  return incomingRank >= localRank;
}
import { shouldAcceptReplicatedTaskState } from '../../refresh/helper/task-projection-acceptance.js';
