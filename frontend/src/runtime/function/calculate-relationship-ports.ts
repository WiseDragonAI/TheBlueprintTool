import { center } from './center.js';
import { elementCanvasRect } from './element-canvas-rect.js';
import { telemetry } from './telemetry.js';

export function calculateRelationshipPorts(source: HTMLElement, target: HTMLElement): { sourcePort: { x: number; y: number }; targetPort: { x: number; y: number }; horizontal: boolean; sourceRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; targetRect: { left: number; top: number; right: number; bottom: number; width: number; height: number } } {
  const sourceRect = elementCanvasRect(source);
  const targetRect = elementCanvasRect(target);
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  const sourcePort = horizontal
    ? { x: targetCenter.x >= sourceCenter.x ? sourceRect.right : sourceRect.left, y: sourceCenter.y }
    : { x: sourceCenter.x, y: targetCenter.y >= sourceCenter.y ? sourceRect.bottom : sourceRect.top };
  const targetPort = horizontal
    ? { x: targetCenter.x >= sourceCenter.x ? targetRect.left : targetRect.right, y: targetCenter.y }
    : { x: targetCenter.x, y: targetCenter.y >= sourceCenter.y ? targetRect.top : targetRect.bottom };
  telemetry('calculate-relationship-ports', { sourceId: source.dataset.cardId, targetId: target.dataset.cardId, sourcePort, targetPort, sourceRect, targetRect });
  return { sourcePort, targetPort, horizontal, sourceRect, targetRect };
}
