import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { createCardFromRect } from '../effect/create-card-from-rect.js';

export async function createCardController(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  telemetry('create-card-controller', { rect });
  await createCardFromRect(rect);
  resetActiveTool('placed-card');
}
