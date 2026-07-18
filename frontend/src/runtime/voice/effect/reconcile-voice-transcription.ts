import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import {
  isPendingVoiceNote,
  isTerminalVoiceStatus,
  shouldApplyVoiceServerNote,
  voiceLifecycleFields,
  voiceTranscriptionDeadlineMs
} from '../helper/voice-transcription-lifecycle.js';

type VoiceIdentity = { projectId?: string; ledgerId: string; threadId: string; noteId: string };
type Watcher = VoiceIdentity & { timer: ReturnType<typeof setTimeout> | null; finalRead: boolean };

const pollIntervalMs = 2_000;
const watchers = new Map<string, Watcher>();
let recoveryListenersInstalled = false;

function watcherKey(input: VoiceIdentity): string {
  return `${input.projectId ?? ''}:${input.ledgerId}:${input.threadId}:${input.noteId}`;
}

function localNote(input: Pick<VoiceIdentity, 'threadId' | 'noteId'>): Record<string, any> | undefined {
  return state.activeLedger ? normalizeLedgerNotes(state.activeLedger)[input.threadId]?.find((note) => String(note.id ?? '') === input.noteId) : undefined;
}

function renderThread(): void {
  void import('../../thread/effect/render-thread-panel.js').then(({ renderThreadPanel }) => {
    if (globalThis.document) renderThreadPanel();
  }).catch(() => undefined);
}

export function applyVoiceServerNote(input: VoiceIdentity & { note: Record<string, unknown> }): boolean {
  const local = localNote(input);
  if (!local || !shouldApplyVoiceServerNote(local, input.note)) return false;
  for (const field of voiceLifecycleFields) {
    if (Object.prototype.hasOwnProperty.call(input.note, field)) local[field] = input.note[field];
  }
  local.revision = Number(input.note.revision ?? local.revision ?? 0);
  local.optimistic = false;
  local.updatedAt = new Date().toISOString();
  renderThread();
  return true;
}

function stopWatcher(key: string): void {
  const watcher = watchers.get(key);
  if (watcher?.timer) clearTimeout(watcher.timer);
  watchers.delete(key);
}

function schedule(watcher: Watcher): void {
  const key = watcherKey(watcher);
  if (!watchers.has(key) || watcher.timer) return;
  watcher.timer = setTimeout(() => {
    watcher.timer = null;
    void reconcileVoiceTranscription(watcher);
  }, pollIntervalMs);
  (watcher.timer as { unref?: () => void }).unref?.();
}

function deadlineReached(note: Record<string, unknown>): boolean {
  const acceptedAt = Date.parse(String(note.acceptedAt ?? note.providerStartedAt ?? ''));
  return Number.isFinite(acceptedAt) && Date.now() - acceptedAt >= voiceTranscriptionDeadlineMs + pollIntervalMs;
}

export async function reconcileVoiceTranscription(input: VoiceIdentity): Promise<boolean> {
  const key = watcherKey(input);
  const watcher = watchers.get(key);
  const note = localNote(input);
  if (!note || isTerminalVoiceStatus(note.status)) {
    stopWatcher(key);
    return false;
  }
  const query = new URLSearchParams({ ledgerId: input.ledgerId, threadId: input.threadId, noteId: input.noteId });
  const response = await fetch(projectScopedRequestPath(`/api/voice-transcription-status?${query.toString()}`, input.projectId || String(state.projectId ?? '') || undefined), { cache: 'no-store' }).catch(() => undefined);
  const payload = response?.ok ? await response.json().catch(() => null) : null;
  const serverNote = payload && typeof payload.note === 'object' ? payload.note as Record<string, unknown> : null;
  const applied = serverNote ? applyVoiceServerNote({ ...input, note: serverNote }) : false;
  const current = localNote(input);
  telemetry('voice-transcription-reconciled', { ...input, status: current?.status ?? '', revision: current?.revision ?? 0, applied, httpStatus: response?.status ?? 0 });
  if (!current || isTerminalVoiceStatus(current.status)) {
    stopWatcher(key);
    return applied;
  }
  if (watcher && deadlineReached(current)) {
    if (watcher.finalRead) stopWatcher(key);
    else {
      watcher.finalRead = true;
      schedule(watcher);
    }
    return applied;
  }
  if (watcher) schedule(watcher);
  return applied;
}

export function watchVoiceTranscription(input: VoiceIdentity): void {
  const key = watcherKey(input);
  if (watchers.has(key)) return;
  const watcher: Watcher = { ...input, timer: null, finalRead: false };
  watchers.set(key, watcher);
  schedule(watcher);
}

export function syncVoiceTranscriptionWatchers(): void {
  const ledgerId = currentLedgerStateId();
  const threadId = String(state.threadId ?? '');
  const notes = state.activeLedger && threadId ? normalizeLedgerNotes(state.activeLedger)[threadId] ?? [] : [];
  const activeKeys = new Set<string>();
  for (const note of notes) {
    if (!isPendingVoiceNote(note)) continue;
    const identity = { projectId: String(state.projectId ?? ''), ledgerId, threadId, noteId: String(note.id ?? '') };
    if (!identity.ledgerId || !identity.noteId) continue;
    activeKeys.add(watcherKey(identity));
    watchVoiceTranscription(identity);
  }
  for (const key of watchers.keys()) if (!activeKeys.has(key)) stopWatcher(key);
}

export function reconcilePendingVoiceTranscriptions(reason = 'recovery'): void {
  telemetry('voice-transcription-recovery', { reason, count: watchers.size });
  for (const watcher of watchers.values()) {
    if (watcher.timer) clearTimeout(watcher.timer);
    watcher.timer = null;
    void reconcileVoiceTranscription(watcher);
  }
}

export function installVoiceTranscriptionRecoveryListeners(): void {
  if (recoveryListenersInstalled) return;
  recoveryListenersInstalled = true;
  globalThis.window?.addEventListener?.('online', () => reconcilePendingVoiceTranscriptions('online'));
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (globalThis.document?.visibilityState === 'visible') reconcilePendingVoiceTranscriptions('visible');
  });
}

export function resetVoiceTranscriptionReconciliationForTests(): void {
  for (const key of [...watchers.keys()]) stopWatcher(key);
  recoveryListenersInstalled = false;
}

export function voiceTranscriptionWatcherCountForTests(): number {
  return watchers.size;
}
