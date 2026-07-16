/**
 * WHAT: Composes the shared thread, voice, file, and Codex controls inside the compact application shell.
 * WHY: Canvas is presentation-specific, while card conversation behavior must remain available on every surface.
 */
import { state } from '../../../runtime/state.js';
import { requestJson, projectPath } from '../../../data/decision-os-api.js';
import { selectThread } from '../../../runtime/thread/effect/select-thread.js';
import { openThreadPanel } from '../../../runtime/thread/effect/open-thread-panel.js';
import { renderThreadPanel } from '../../../runtime/thread/effect/render-thread-panel.js';
import { handleActionClick } from '../../../runtime/input/controller/handle-action-click.js';
import { saveThreadDraft } from '../../../runtime/thread/effect/persist-thread-draft.js';
import { uploadThreadFileController } from '../../../runtime/thread/controller/upload-thread-file-controller.js';

let inputsBound = false;

function ensureThreadPanel(): void {
  // WHAT: Reuse an existing shared panel when the current route already mounted one.
  // WHY: Repeated card navigation must not duplicate thread state or event listeners.
  if (document.querySelector('.thread-panel')) return;
  const panel = document.createElement('aside');
  panel.className = 'panel compact-thread-inspector';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Card thread');
  panel.innerHTML = `<section class="thread-panel agent-chat phone" hidden>
    <div class="thread-chat-shell"><main class="chat"><header class="thread-heading"><div class="thread-toolbar">
      <p class="thread-target">Card thread</p><div class="thread-tabs" role="tablist" aria-label="Thread views">
      <button id="thread-tab-thread" class="thread-tab" type="button" role="tab" aria-selected="true" aria-controls="thread-panel-thread">Thread</button>
      <button id="thread-tab-codex-log" class="thread-tab" type="button" role="tab" aria-selected="false" aria-controls="thread-panel-codex-log">Codex Log</button></div>
      <button class="thread-close terminal-button terminal-button--compact" type="button" data-action="close-thread-panel">×</button></div><div class="thread-actions"></div></header>
      <div class="thread-tab-panels"><section id="thread-panel-thread" class="thread-tab-panel thread-conversation-panel" role="tabpanel"><div class="thread-conversation-scroll"><section class="thread-feed" aria-live="polite"></section></div></section>
      <section id="thread-panel-codex-log" class="thread-tab-panel thread-log-panel" role="tabpanel" hidden><div class="thread-log-scroll"><section class="thread-codex-log"></section></div></section></div>
    </main></div><footer class="io voice-panel"></footer></section>`;
  document.body.append(panel);
}

export async function openCompactThread(input: { projectId: string; ledgerId: string; cardId: string }): Promise<void> {
  ensureThreadPanel();
  const ledger = await requestJson<Record<string, unknown>>(projectPath(input.projectId, `/api/ledgers/${encodeURIComponent(input.ledgerId)}/canvas`));
  state.projectId = input.projectId;
  state.activeTab = input.ledgerId;
  state.activeLedgerId = input.ledgerId;
  state.activeLedger = ledger;
  selectThread(`thread-${input.cardId}`);
  renderThreadPanel();
  openThreadPanel();
  if (!inputsBound) {
    inputsBound = true;
    document.addEventListener('click', (event) => { void handleActionClick(event as MouseEvent); });
    document.addEventListener('input', (event) => {
      if ((event.target as HTMLElement | null)?.closest('.thread-draft')) saveThreadDraft();
    });
    document.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.matches('.thread-file-input')) void uploadThreadFileController(target);
    });
  }
}
