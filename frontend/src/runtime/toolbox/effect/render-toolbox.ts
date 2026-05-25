import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderToolbox(): void {
  document.querySelectorAll('[data-tool]').forEach((tool) => tool.classList.toggle('active', (tool as HTMLElement).dataset.tool === state.activeTool));
  const picker = document.querySelector('.color-picker') as HTMLElement;
  picker.hidden = state.activeTool !== 'zone';
  const input = picker.querySelector('input[type="color"]') as HTMLInputElement | null;
  if (input) input.value = state.zoneColor;
  telemetry('render-toolbox', { activeTool: state.activeTool, colorPicker: state.activeTool === 'zone' });
}
