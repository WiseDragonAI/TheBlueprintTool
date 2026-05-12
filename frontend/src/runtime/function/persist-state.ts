import { state } from '../state.js';
import { snapshotCanvasGeometry } from './snapshot-canvas-geometry.js';

export function persistState(): void {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  if (state.activeTab === 'surface') state.surfaceViewport = { ...state.viewport };
  localStorage.setItem('corev2.canvas.state', JSON.stringify({ viewport: state.viewport, viewports: state.viewports, selection: state.selection, activeTab: state.activeTab, geometry: snapshotCanvasGeometry() }));
}
