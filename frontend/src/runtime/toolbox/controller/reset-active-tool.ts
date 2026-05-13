import { state } from '../../state.js';
import { renderToolbox } from '../effect/render-toolbox.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function resetActiveTool(reason: string): void {
  state.activeTool = 'select';
  telemetry('resolve-tool-mode', { activeTool: state.activeTool, reason });
  renderToolbox();
}
