/**
 * WHAT: Renders the active thread notes from the current ledger into the inspector.
 * WHY: Voice and text notes must appear as conversation ledger entries, not only draft text.
 */
import { state } from '../../state.js';
import { isCodexThreadArtifactNote } from '../../codex/helper/is-codex-thread-artifact-note.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { deletedNoteIdSet } from '../../ledger/helper/normalize-deleted-note-ids.js';
import { syncVoiceTranscriptionWatchers } from '../../voice/effect/reconcile-voice-transcription.js';
import { syncVoiceProgressClock } from '../../voice/effect/run-voice-progress-clock.js';
import { voicePhaseElapsedSeconds, voicePhaseLabel, voicePhaseStartedAt } from '../../voice/helper/voice-transcription-lifecycle.js';

type ThreadImageSizes = Record<string, { width?: number; height?: number }>;

const pendingThreadImageSizeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function noteText(note: Record<string, unknown>): string {
  return String(note.message ?? note.body ?? '');
}

function imageSizeSignature(note: Record<string, unknown>): string {
  const sizes = threadImageSizes(note.imageSizes);
  const entries = Object.entries(sizes).sort(([left], [right]) => left.localeCompare(right));
  return entries.map(([source, dimensions]) => `${source}:${dimensions.width ?? ''}x${dimensions.height ?? ''}`).join(',');
}

function threadNotesSignature(threadId: string, notes: Array<Record<string, unknown>>): string {
  const parts = [threadId, String(notes.length)];
  for (const note of notes) {
    const text = noteText(note);
    parts.push([
      String(note.id ?? ''),
      String(note.role ?? 'operator'),
      String(note.status ?? ''),
      String(note.error ?? ''),
      String(note.voiceFileRef ?? ''),
      String(note.transcriptionStartedAt ?? ''),
      String(note.revision ?? ''),
      String(note.acceptedAt ?? ''),
      String(note.providerStartedAt ?? ''),
      String(note.providerSettledAt ?? ''),
      String(note.optimistic ?? ''),
      imageSizeSignature(note),
      String(text.length),
      hashText(text)
    ].join(':'));
  }
  return hashText(parts.join('|'));
}

function noteListDataset(list: HTMLElement): DOMStringMap {
  const element = list as HTMLElement & { dataset?: DOMStringMap };
  if (!element.dataset) element.dataset = {} as DOMStringMap;
  return element.dataset;
}

function threadImageSizes(value: unknown): ThreadImageSizes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const sizes: ThreadImageSizes = {};
  for (const [source, dimensions] of Object.entries(value as Record<string, unknown>)) {
    if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) continue;
    const width = Number((dimensions as Record<string, unknown>).width);
    const height = Number((dimensions as Record<string, unknown>).height);
    sizes[source] = {
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      height: Number.isFinite(height) && height > 0 ? height : undefined
    };
  }
  return sizes;
}

function persistThreadImageSize(input: { threadId: string; note: Record<string, unknown>; source: string; width: number; height: number }): void {
  const noteId = String(input.note.id ?? '');
  if (!input.threadId || !noteId) return;
  const imageSizes = threadImageSizes(input.note.imageSizes);
  const existing = imageSizes[input.source] ?? {};
  if (existing.width === input.width && existing.height === input.height) return;
  imageSizes[input.source] = { width: input.width, height: input.height };
  input.note.imageSizes = imageSizes;
  const timerKey = `${input.threadId}:${noteId}:${input.source}`;
  const pending = pendingThreadImageSizeTimers.get(timerKey);
  if (pending) clearTimeout(pending);
  pendingThreadImageSizeTimers.set(timerKey, setTimeout(() => {
    pendingThreadImageSizeTimers.delete(timerKey);
    void sendActiveLedgerMutation({
      action: 'update-note',
      note: { id: noteId, threadId: input.threadId, imageSizes: threadImageSizes(input.note.imageSizes) }
    });
  }, 240));
}

export function renderThreadNotes(): void {
  const existing = document.querySelector('.thread-note-list') as HTMLElement | null;
  const feed = document.querySelector('.thread-feed') as HTMLElement | null;
  if (!feed && !existing) return;
  const list = existing ?? document.createElement('ol');
  list.className = 'thread-note-list';
  if (!existing) feed?.append(list);
  const deletedIds = state.threadId && state.activeLedger ? deletedNoteIdSet(state.activeLedger, state.threadId) : new Set<string>();
  const notes = state.threadId
    ? (state.activeLedger?.notes?.[state.threadId] ?? []).filter((note: Record<string, unknown>) => (
        !deletedIds.has(String(note.id ?? '')) && !isCodexThreadArtifactNote(note)
      ))
    : [];
  syncVoiceTranscriptionWatchers();
  const signature = threadNotesSignature(String(state.threadId ?? ''), notes);
  const dataset = noteListDataset(list);
  if (existing && dataset.threadId === String(state.threadId ?? '') && dataset.notesSignature === signature) {
    syncVoiceProgressClock();
    return;
  }
  dataset.threadId = String(state.threadId ?? '');
  dataset.notesSignature = signature;
  list.replaceChildren();
  for (const note of notes) {
    const status = String(note.status ?? '');
    const role = String(note.role ?? 'operator').toLowerCase();
    const agentOwned = role === 'agent' || role === 'assistant';
    const noteId = String(note.id ?? '');
    const normalizedStatus = status.toLowerCase();
    const error = String(note.error ?? '').trim();
    const busy = /committing|uploading|queued|transcribing|finalizing|retrying/.test(normalizedStatus);
    const localVoiceUploadId = String(note.localVoiceUploadId ?? '');
    const retryable = (Boolean(note.voiceFileRef) && normalizedStatus === 'transcription failed') || (Boolean(localVoiceUploadId) && normalizedStatus === 'upload failed');
    const voiceOwned = Boolean(note.voiceFileRef);
    const phaseLabel = voiceOwned ? voicePhaseLabel(status) : status;
    const item = document.createElement('li');
    item.className = ['thread-note', note.voiceFileRef ? 'voice-note' : '', note.optimistic ? 'is-optimistic' : '', busy ? 'is-busy' : '', retryable ? 'is-retryable' : '', agentOwned ? 'is-agent' : 'is-operator'].filter(Boolean).join(' ');
    const body = renderLedgerCardMarkdown(noteText(note), {
      imageSizes: threadImageSizes(note.imageSizes),
      mediaSurface: 'thread',
      onImageResize: (source, dimensions) => {
        persistThreadImageSize({
          threadId: state.threadId,
          note,
          source,
          width: dimensions.width,
          height: dimensions.height
        });
      }
    });
    body.classList.add('thread-note-message');
    const meta = document.createElement('span');
    meta.className = 'thread-note-meta';
    meta.textContent = phaseLabel;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'thread-note-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-note';
    deleteButton.dataset.threadId = state.threadId;
    deleteButton.dataset.noteId = noteId;
    deleteButton.title = 'Delete note';
    deleteButton.setAttribute('aria-label', 'Delete note');
    deleteButton.textContent = 'X';
    item.append(body);
    if (status && !busy) item.append(meta);
    // WHAT: Surface the server-owned terminal failure beside the generic lifecycle label.
    // WHY: Persisted provider and configuration errors must remain actionable after reconciliation.
    if (error && normalizedStatus.endsWith('failed')) {
      const errorMessage = document.createElement('span');
      errorMessage.className = 'thread-note-error';
      errorMessage.setAttribute('role', 'alert');
      errorMessage.textContent = error;
      item.append(errorMessage);
    }
    if (noteId) item.append(deleteButton);
    if (busy) {
      const spinner = document.createElement('span');
      spinner.className = 'thread-note-spinner';
      const elapsed = voiceOwned ? voicePhaseElapsedSeconds(note) : null;
      spinner.textContent = `${phaseLabel || 'Processing'}${elapsed === null ? '' : ` · ${elapsed}s`}`;
      const phaseStartedAt = voiceOwned ? voicePhaseStartedAt(note) : '';
      if (phaseStartedAt) {
        spinner.dataset.voicePhaseStartedAt = phaseStartedAt;
        spinner.dataset.voicePhaseLabel = phaseLabel || 'Processing';
      }
      item.append(spinner);
    }
    if (retryable) {
      const retry = document.createElement('button');
      retry.className = 'thread-note-retry terminal-button terminal-button--compact';
      retry.type = 'button';
      retry.dataset.action = 'voice-retry';
      retry.dataset.spec = 'c73a0e4d';
      retry.dataset.threadId = state.threadId;
      retry.dataset.noteId = String(note.id ?? '');
      retry.dataset.voiceFileRef = String(note.voiceFileRef ?? '');
      retry.dataset.localVoiceUploadId = localVoiceUploadId;
      retry.textContent = 'Retry';
      item.append(retry);
    }
    list.append(item);
  }
  syncVoiceProgressClock();
}
