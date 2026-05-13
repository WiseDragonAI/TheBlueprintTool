import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function selectAllVisible(): void {
  state.selection.cardIds = Array.from(document.querySelectorAll('[data-card-id]')).map((node) => (node as HTMLElement).dataset.cardId);
  state.selection.zoneIds = Array.from(document.querySelectorAll('[data-zone-id]')).map((node) => (node as HTMLElement).dataset.zoneId);
  telemetry('calculate-marquee-selection', { selection: state.selection });
}
