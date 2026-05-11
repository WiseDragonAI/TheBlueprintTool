import { state } from '../state.js';
import { snapshotCanvasGeometry } from './snapshot-canvas-geometry.js';

export function persistState(): void {
  localStorage.setItem('corev2.canvas.state', JSON.stringify({ viewport: state.viewport, selection: state.selection, activeTab: state.activeTab, geometry: snapshotCanvasGeometry() }));
}
