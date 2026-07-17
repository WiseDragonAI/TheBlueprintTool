/**
 * WHAT: Opens the right-side terminal thread panel without stealing keyboard focus.
 * WHY: The first A press should leave voice shortcuts available; a second A focuses text.
 */
import { state } from '../../state.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { isThreadFollowingBottom, setThreadFollowBottom } from '../helper/thread-follow-bottom.js';

export function openThreadPanel(): void {
  state.threadPanelOpen = true;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  if (!state.threadActiveTabByThreadId || typeof state.threadActiveTabByThreadId !== 'object') state.threadActiveTabByThreadId = {};
  if (!state.threadActiveTabByThreadId[state.threadId]) state.threadActiveTabByThreadId[state.threadId] = 'thread';
  if (isThreadFollowingBottom(state.threadId, state.threadActiveTabByThreadId[state.threadId])) {
    setThreadFollowBottom(state.threadId, true, state.threadActiveTabByThreadId[state.threadId]);
    state.threadPinOnRender = true;
  } else state.threadPinOnRender = false;
  renderThreadPanel();
}
