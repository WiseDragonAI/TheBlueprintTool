import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { createZoneFromRect } from '../effect/create-zone-from-rect.js';

export async function createZoneController(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  telemetry('create-zone-controller', { rect });
  await createZoneFromRect(rect);
  resetActiveTool('placed-zone');
}
