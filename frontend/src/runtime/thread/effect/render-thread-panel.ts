/**
 * WHAT: Renders the active thread as a two-row header above independent Thread and Codex Log panels.
 * WHY: Conversation controls, run diagnostics, focus, announcements, and scroll must keep separate ownership.
 */
import { bindThreadCodexRunLog } from '../../codex/effect/bind-thread-codex-run-log.js';
import { cardCodexRunId } from '../../codex/helper/card-codex-run-id.js';
import { codexEffortOptions, codexModelOptions } from '../../codex/helper/codex-run-options.js';
import { cardCodexRunPreference, type CardCodexRunPreference } from '../../codex/helper/card-codex-run-preference.js';
import { persistCardCodexRunPreference } from '../../codex/effect/persist-card-codex-run-preference.js';
import { threadCodexCardId } from '../../codex/helper/thread-codex-card-id.js';
import { state, type ThreadPanelTab } from '../../state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceDock } from '../../voice/effect/render-voice-dock.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { resolveThreadTargetTitle } from '../helper/resolve-thread-target-title.js';
import { applyThreadAccent } from './apply-thread-accent.js';
import { pinThreadFeedToLastMessage } from './pin-thread-feed-to-last-message.js';
import { isThreadFollowingBottom } from '../helper/thread-follow-bottom.js';
import { restoreThreadDraft } from './persist-thread-draft.js';
import { restoreThreadScrollPosition, saveThreadScrollPosition } from './persist-thread-scroll.js';
import { renderThreadCodexLog } from './render-thread-codex-log.js';
import { renderThreadJumpButton, syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';
import { renderThreadNotes } from './render-thread-notes.js';
import { syncThreadCodexRunControls } from './sync-thread-codex-run-controls.js';
import { restorePendingVoiceUploads } from '../../voice/effect/restore-pending-voice-uploads.js';

const threadTabOrder: ThreadPanelTab[] = ['thread', 'codex-log'];

function threadCodexPreference(threadId: string): CardCodexRunPreference {
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  const card = cardId
    ? state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId)
    : null;
  return cardCodexRunPreference(card);
}

function activeTabState(): Record<string, ThreadPanelTab> {
  if (!state.threadActiveTabByThreadId || typeof state.threadActiveTabByThreadId !== 'object' || Array.isArray(state.threadActiveTabByThreadId)) {
    state.threadActiveTabByThreadId = {};
  }
  return state.threadActiveTabByThreadId as Record<string, ThreadPanelTab>;
}

export function activeThreadPanelTab(threadId = String(state.threadId ?? '')): ThreadPanelTab {
  const tabs = activeTabState();
  if (!threadId) return 'thread';
  if (tabs[threadId] !== 'codex-log') tabs[threadId] = 'thread';
  return tabs[threadId];
}

function renderThreadCodexSelect(input: { preference: 'model' | 'effort'; label: string; value: string; options: readonly string[]; onChange: (value: string) => void }): HTMLLabelElement {
  const field = document.createElement('label');
  field.className = `thread-codex-field thread-codex-field--${input.preference}`;
  const label = document.createElement('span');
  label.className = 'thread-codex-field-label';
  label.textContent = input.label;
  const select = document.createElement('select');
  select.className = 'thread-codex-select';
  select.dataset.codexPreference = input.preference;
  select.setAttribute('aria-label', `${input.label} for thread Codex`);
  select.title = `${input.label}: ${input.value}`;
  for (const value of input.options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value;
  select.addEventListener('change', () => {
    select.title = `${input.label}: ${select.value}`;
    input.onChange(select.value);
  });
  field.replaceChildren(label, select);
  return field;
}

function renderThreadActions(threadId: string): void {
  const heading = document.querySelector('.thread-heading') as HTMLElement | null;
  if (!heading) return;
  let actions = heading.querySelector('.thread-actions') as HTMLElement | null;
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'thread-actions';
    (heading.querySelector('.thread-toolbar') ?? heading).append(actions);
  }
  const preference = threadCodexPreference(threadId);
  const threadCodexModel = preference.model;
  const threadCodexEffort = preference.effort;
  if (actions.dataset.threadId === threadId) {
    const button = actions.querySelector('.thread-codex-button') as HTMLButtonElement | null;
    if (button) {
      button.dataset.threadId = threadId;
      button.dataset.codexCardId = threadCodexCardId(state.activeLedger, threadId);
      button.dataset.codexModel = threadCodexModel;
      button.dataset.codexEffort = threadCodexEffort;
    }
    const model = actions.querySelector('[data-codex-preference="model"]') as HTMLSelectElement | null;
    const effort = actions.querySelector('[data-codex-preference="effort"]') as HTMLSelectElement | null;
    if (model) {
      model.value = threadCodexModel;
      model.title = `Model: ${threadCodexModel}`;
    }
    if (effort) {
      effort.value = threadCodexEffort;
      effort.title = `Effort: ${threadCodexEffort}`;
    }
    const summary = state.threadRunSummaryByThreadId?.[threadId] as { ok?: boolean; status?: string } | undefined;
    syncThreadCodexRunControls({ threadId, running: summary?.ok === true && summary.status === 'running' });
    return;
  }
  actions.replaceChildren();
  actions.dataset.threadId = threadId;
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  if (!cardId) return;

  const button = document.createElement('button');
  button.className = 'thread-codex-button terminal-button terminal-button--compact';
  button.type = 'button';
  button.dataset.action = 'process-thread-codex';
  button.dataset.threadId = threadId;
  button.dataset.codexCardId = cardId;
  button.dataset.codexModel = threadCodexModel;
  button.dataset.codexEffort = threadCodexEffort;
  button.title = 'Start Codex from this thread';
  button.setAttribute('aria-label', button.title);
  const key = document.createElement('span');
  key.className = 'terminal-button__key';
  key.textContent = '>';
  const label = document.createElement('span');
  label.className = 'terminal-button__label';
  label.textContent = 'Codex';
  button.replaceChildren(key, label);

  const model = renderThreadCodexSelect({
    preference: 'model',
    label: 'Model',
    value: threadCodexModel,
    options: codexModelOptions,
    onChange: (value) => {
      void persistCardCodexRunPreference({ cardId, model: value, effort: effortSelect.value });
    },
  });
  const modelSelect = model.querySelector('select') as HTMLSelectElement;
  const effort = renderThreadCodexSelect({
    preference: 'effort',
    label: 'Effort',
    value: threadCodexEffort,
    options: codexEffortOptions,
    onChange: (value) => {
      void persistCardCodexRunPreference({ cardId, model: modelSelect.value, effort: value });
    },
  });
  const effortSelect = effort.querySelector('select') as HTMLSelectElement;
  actions.append(model, effort, button);
  const summary = state.threadRunSummaryByThreadId?.[threadId] as { ok?: boolean; status?: string } | undefined;
  syncThreadCodexRunControls({ threadId, running: summary?.ok === true && summary.status === 'running' });
}

function tabButton(tab: ThreadPanelTab): HTMLButtonElement | null {
  const id = `thread-tab-${tab}`;
  return ((document as Document & { getElementById?: (value: string) => HTMLElement | null }).getElementById?.(id)
    ?? document.querySelector(`#${id}`)) as HTMLButtonElement | null;
}

function updateTabDom(threadId: string): void {
  const activeTab = activeThreadPanelTab(threadId);
  for (const tab of threadTabOrder) {
    const button = tabButton(tab);
    const panelId = `thread-panel-${tab}`;
    const panel = ((document as Document & { getElementById?: (value: string) => HTMLElement | null }).getElementById?.(panelId)
      ?? document.querySelector(`#${panelId}`)) as HTMLElement | null;
    const active = tab === activeTab;
    if (button) {
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.dataset.threadTab = tab;
      button.onclick = () => setThreadPanelTab(tab, { focus: false });
      button.onkeydown = (event) => {
        const currentIndex = threadTabOrder.indexOf(tab);
        let nextIndex = -1;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % threadTabOrder.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + threadTabOrder.length) % threadTabOrder.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = threadTabOrder.length - 1;
        if (nextIndex < 0) return;
        event.preventDefault();
        setThreadPanelTab(threadTabOrder[nextIndex], { focus: true });
      };
    }
    if (panel) panel.hidden = !active;
  }
  const feed = document.querySelector('.thread-feed') as HTMLElement | null;
  feed?.setAttribute('aria-live', activeTab === 'thread' ? 'polite' : 'off');
}

export function setThreadPanelTab(tab: ThreadPanelTab, options: { focus?: boolean } = {}): void {
  const threadId = String(state.threadId ?? '');
  if (!threadId || !threadTabOrder.includes(tab)) return;
  const previous = activeThreadPanelTab(threadId);
  saveThreadScrollPosition(threadId, previous);
  activeTabState()[threadId] = tab;
  renderThreadPanel();
  if (options.focus) tabButton(tab)?.focus();
}

function activeThreadCard(threadId: string): { cardId: string; card: Record<string, unknown> | null } {
  const cardId = threadCodexCardId(state.activeLedger, threadId);
  const card = cardId
    ? state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId) ?? null
    : null;
  return { cardId, card };
}

function bindActiveThreadRun(threadId: string): void {
  const { cardId, card } = activeThreadCard(threadId);
  const runId = card ? cardCodexRunId(card) : '';
  const ledgerId = String(state.activeTab ?? '').trim();
  if (ledgerId && cardId && runId) bindThreadCodexRunLog({ ledgerId, cardId, threadId, runId });
}

export function renderThreadPanel(): void {
  const panel = document.querySelector('.thread-panel') as HTMLElement | null;
  const inspector = document.querySelector('.panel') as HTMLElement | null;
  const shell = document.querySelector('.shell') as HTMLElement | null;
  if (!panel || !inspector || !shell) return;
  const shouldOpenThread = Boolean(state.threadPanelOpen || state.activeTool === 'thread');
  const activeThreadId = String(state.threadId ?? '');
  const activeTab = activeThreadPanelTab(activeThreadId);
  const shouldPinThread = Boolean(shouldOpenThread && state.threadPinOnRender);
  const shouldFollowBottom = Boolean(shouldOpenThread && activeTab === 'thread' && isThreadFollowingBottom(activeThreadId));
  const sameRenderedThread = activeThreadId && state.renderedThreadId === activeThreadId;
  if (shouldOpenThread && !shouldPinThread && !shouldFollowBottom && sameRenderedThread) saveThreadScrollPosition(activeThreadId, activeTab);

  inspector.hidden = !shouldOpenThread;
  panel.hidden = !shouldOpenThread;
  shell.classList.toggle('has-inspector', shouldOpenThread);

  const target = document.querySelector('.thread-target') as HTMLElement | null;
  if (target) {
    const title = activeThreadId ? resolveThreadTargetTitle(activeThreadId) : 'No thread selected';
    target.replaceChildren();
    const titleText = document.createElement('span');
    titleText.className = 'thread-target-title';
    titleText.textContent = title;
    titleText.title = title;
    target.title = title;
    target.append(titleText);
  }

  renderThreadActions(activeThreadId);
  updateTabDom(activeThreadId);
  applyThreadAccent();
  telemetry('render-thread-panel', { threadId: activeThreadId, tab: activeTab });
  renderThreadNotes();
  void restorePendingVoiceUploads(activeThreadId);
  bindActiveThreadRun(activeThreadId);
  renderThreadCodexLog();
  renderThreadJumpButton(activeTab === 'thread');
  state.renderedThreadId = activeThreadId;
  renderVoiceDock({ visible: activeTab === 'thread' });
  if (activeTab === 'thread') {
    restoreThreadDraft();
    renderVoiceStatus();
  }
  renderTelemetry();

  if (shouldPinThread || shouldFollowBottom) {
    state.threadPinOnRender = false;
    pinThreadFeedToLastMessage();
  } else if (shouldOpenThread) {
    restoreThreadScrollPosition(activeThreadId, activeTab);
  }
  syncThreadJumpButtonVisibility();
}
