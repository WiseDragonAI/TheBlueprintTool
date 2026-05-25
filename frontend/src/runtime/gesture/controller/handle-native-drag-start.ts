import { telemetry } from '../../telemetry/effect/telemetry.js';
import { isGestureControlTarget } from '../helper/is-gesture-control-target.js';

export function handleNativeDragStart(event: DragEvent): void {
  if (isGestureControlTarget(event.target)) return;
  event.preventDefault();
  telemetry('suppress-native-drag', { target: (event.target as HTMLElement | null)?.className ?? '' });
}
