// @ts-nocheck
/**
 * WHAT: Generated controller function operate-toolbox-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { renderCanvasSurface } from '@frontend/business/canvas/effect/render-canvas-surface.js';
import { renderToolbox } from '@frontend/business/toolbox/effect/render-toolbox.js';
import { resolveToolMode } from '@frontend/business/toolbox/helper/resolve-tool-mode.js';

export async function operateToolboxController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:operate-toolbox-controller -> start', { functionName: 'operate-toolbox-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:operate-toolbox-controller -> operate-toolbox-controller-started', { functionName: 'operate-toolbox-controller', phase: 'event' });
    try {
      await resolveToolMode({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'operate-toolbox-controller', dependencyName: 'resolve-tool-mode', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderToolbox({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'operate-toolbox-controller', dependencyName: 'render-toolbox', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderCanvasSurface({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'operate-toolbox-controller', dependencyName: 'render-canvas-surface', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:operate-toolbox-controller -> operate-toolbox-controller-completed', { functionName: 'operate-toolbox-controller', phase: 'event' });
  } finally {
    telemetry('controller:operate-toolbox-controller -> complete', { functionName: 'operate-toolbox-controller', phase: 'completed', arguments: input });
  }
}
