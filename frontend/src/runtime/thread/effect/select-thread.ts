/**
 * WHAT: Sets the active thread and clears stale idle voice status when context changes.
 * WHY: Voice upload state is thread-scoped and must not follow the operator to another card.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { saveThreadDraft } from './persist-thread-draft.js';
import { hasSavedThreadScrollPosition, saveThreadScrollPosition } from './persist-thread-scroll.js';

export function selectThread(threadId: string): void {
  const previousThreadId = String(state.threadId ?? '');
  if (previousThreadId === threadId) return;
  if (state.voice.recording) {
    telemetry('resolve-thread-target-blocked', { threadId, previousThreadId, reason: 'voice-recording' });
    return;
  }
  saveThreadDraft(previousThreadId);
  saveThreadScrollPosition(previousThreadId);
  state.threadId = threadId;
  state.threadPinOnRender = !hasSavedThreadScrollPosition(threadId);
  state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  telemetry('resolve-thread-target', { threadId, previousThreadId });
}
