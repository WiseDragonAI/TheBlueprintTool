import { state } from '../../state.js';
import { elementsIntersectingCanvasRect } from '../helper/elements-intersecting-canvas-rect.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

type CanvasRect = { x: number; y: number; width: number; height: number };

export function selectIntersecting(rect: CanvasRect): void {
  state.selection.cardIds = elementsIntersectingCanvasRect(rect, '[data-card-id]', 'cardId');
  state.selection.zoneIds = elementsIntersectingCanvasRect(rect, '[data-zone-id]', 'zoneId');
  state.selection.groupIds = elementsIntersectingCanvasRect(rect, '[data-group-id]', 'groupId');
  telemetry('calculate-marquee-selection', { rect, selection: state.selection });
}
