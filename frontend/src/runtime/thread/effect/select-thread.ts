/**
 * WHAT: Sets the active thread and clears stale idle voice status when context changes.
 * WHY: Voice upload state is thread-scoped and must not follow the operator to another card.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { saveThreadDraft } from './persist-thread-draft.js';
import { saveThreadPanelScrollPositions } from './persist-thread-scroll.js';
import { requestThreadViewportEntry } from './request-thread-viewport-entry.js';
import { threadPanelTabState } from '../helper/thread-panel-tab-state.js';

export function selectThread(threadId: string, options: { requestViewportEntry?: boolean } = {}): void {
  const previousThreadId = String(state.threadId ?? '');
  if (previousThreadId === threadId) return;
  if (state.voice.recording) {
    telemetry('resolve-thread-target-blocked', { threadId, previousThreadId, reason: 'voice-recording' });
    return;
  }
  saveThreadDraft(previousThreadId);
  saveThreadPanelScrollPositions(previousThreadId);
  state.threadId = threadId;
  const tabs = threadPanelTabState();
  if (threadId && tabs[threadId] !== 'codex-log') tabs[threadId] = 'thread';
  const activeTab = tabs[threadId];
  // WHAT: Emit entry intent for direct thread switches unless an enclosing panel controller owns it.
  // WHY: Selection while an open panel is visible must still land on the newly activated surface bottom.
  if (threadId && options.requestViewportEntry !== false) requestThreadViewportEntry(threadId, activeTab, 'thread-switch');
  state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' };
  telemetry('resolve-thread-target', { threadId, previousThreadId });
}
