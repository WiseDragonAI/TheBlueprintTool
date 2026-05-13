import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderToolbox(): void {
  document.querySelectorAll('[data-tool]').forEach((tool) => tool.classList.toggle('active', (tool as HTMLElement).dataset.tool === state.activeTool));
  (document.querySelector('.color-picker') as HTMLElement).hidden = state.activeTool !== 'zone';
  telemetry('render-toolbox', { activeTool: state.activeTool, colorPicker: state.activeTool === 'zone' });
}
