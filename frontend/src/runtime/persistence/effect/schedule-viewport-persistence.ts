import { state } from '../../state.js';
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { readPersistedState } from '../helper/read-persisted-state.js';

let viewportPersistenceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleViewportPersistence(delayMs = 140): void {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  if (state.activeTab === 'surface') state.surfaceViewport = { ...state.viewport };
  if (viewportPersistenceTimer) clearTimeout(viewportPersistenceTimer);
  viewportPersistenceTimer = setTimeout(() => {
    viewportPersistenceTimer = null;
    if (state.canvasMode === 'ledgers' || state.canvasMode === 'projects') {
      void sendActiveLedgerMutation({ action: 'patch-viewport', viewport: { ...state.viewport } });
    }
    const persisted = readPersistedState();
    localStorage.setItem('decision-os.canvas.state', JSON.stringify({
      ...persisted,
      viewport: state.viewport,
      viewports: state.viewports,
      activeTab: state.activeTab,
      railCollapsed: state.railCollapsed
    }));
  }, delayMs);
}
