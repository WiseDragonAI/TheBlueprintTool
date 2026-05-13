import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { createGroupFromRect } from '../effect/create-group-from-rect.js';

export function createGroupController(rect: { x: number; y: number; width: number; height: number }): void {
  telemetry('create-group-controller', { rect });
  createGroupFromRect(rect);
  resetActiveTool('placed-group');
}
