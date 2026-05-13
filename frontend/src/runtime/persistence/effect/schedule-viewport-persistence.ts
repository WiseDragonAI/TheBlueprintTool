import { state } from '../../state.js';
import { readPersistedState } from '../helper/read-persisted-state.js';

let viewportPersistenceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleViewportPersistence(delayMs = 140): void {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  if (state.activeTab === 'surface') state.surfaceViewport = { ...state.viewport };
  if (viewportPersistenceTimer) clearTimeout(viewportPersistenceTimer);
  viewportPersistenceTimer = setTimeout(() => {
    viewportPersistenceTimer = null;
    const persisted = readPersistedState();
    localStorage.setItem('corev2.canvas.state', JSON.stringify({
      ...persisted,
      viewport: state.viewport,
      viewports: state.viewports,
      activeTab: state.activeTab
    }));
  }, delayMs);
}
