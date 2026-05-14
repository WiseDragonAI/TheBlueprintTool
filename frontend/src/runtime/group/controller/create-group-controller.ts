import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { createGroupFromRect } from '../effect/create-group-from-rect.js';

export async function createGroupController(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  telemetry('create-group-controller', { rect });
  await createGroupFromRect(rect);
  resetActiveTool('placed-group');
}
