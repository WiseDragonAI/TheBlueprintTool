export const voiceTranscriptionTimeoutMs = 30_000;
export const voiceTranscriptionTimeoutSpec = 'c73a0e4d';
const timeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();

export function expireStaleVoiceTranscription(note: Record<string, unknown>, now = Date.now()): boolean {
  const status = String(note.status ?? '').toLowerCase();
  if (!note.voiceFileRef || status !== 'transcribing') return false;
  const startedAt = typeof note.transcriptionStartedAt === 'string' ? Date.parse(note.transcriptionStartedAt) : NaN;
  if (Number.isFinite(startedAt) && now - startedAt < voiceTranscriptionTimeoutMs) return false;
  note.status = 'transcription failed';
  note.message = 'Voice uploaded; transcription failed.';
  note.error = Number.isFinite(startedAt) ? 'Transcription timed out after 30 seconds.' : 'Transcription state was missing a start time.';
  note.updatedAt = new Date(now).toISOString();
  return true;
}

export function scheduleVoiceTranscriptionTimeout(input: { threadId: string; note: Record<string, unknown>; now?: number }): void {
  const status = String(input.note.status ?? '').toLowerCase();
  const noteId = String(input.note.id ?? '');
  const startedAtText = String(input.note.transcriptionStartedAt ?? '');
  if (!input.threadId || !noteId || !input.note.voiceFileRef || status !== 'transcribing' || !startedAtText) return;
  const startedAt = Date.parse(startedAtText);
  if (!Number.isFinite(startedAt)) return;
  const key = `${input.threadId}:${noteId}:${startedAtText}`;
  if (timeoutHandles.has(key)) return;
  const now = input.now ?? Date.now();
  const delay = Math.max(0, voiceTranscriptionTimeoutMs - (now - startedAt));
  const handle = setTimeout(() => {
    timeoutHandles.delete(key);
    if (!expireStaleVoiceTranscription(input.note)) return;
    void import('../../thread/effect/render-thread-panel.js').then(({ renderThreadPanel }) => {
      if (globalThis.document) renderThreadPanel();
    }).catch(() => undefined);
  }, delay);
  (handle as { unref?: () => void }).unref?.();
  timeoutHandles.set(key, handle);
}
