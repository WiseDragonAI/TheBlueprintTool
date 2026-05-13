import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handleNativeDragStart(event: DragEvent): void {
  event.preventDefault();
  telemetry('suppress-native-drag', { target: (event.target as HTMLElement | null)?.className ?? '' });
}
