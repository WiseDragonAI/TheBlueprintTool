import { state } from '../../state.js';
import { snapshotCanvasGeometry } from '../helper/snapshot-canvas-geometry.js';
import { snapshotCanvasRegionEdits } from '../helper/snapshot-canvas-region-edits.js';

export function persistState(): void {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  if (state.activeTab === 'surface') state.surfaceViewport = { ...state.viewport };
  localStorage.setItem('decision-os.canvas.state', JSON.stringify({ viewport: state.viewport, viewports: state.viewports, selection: state.selection, activeTab: state.activeTab, railCollapsed: state.railCollapsed, geometry: snapshotCanvasGeometry(), regionEdits: snapshotCanvasRegionEdits() }));
}
