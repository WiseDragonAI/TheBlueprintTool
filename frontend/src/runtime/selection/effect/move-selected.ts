import { state } from '../../state.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function moveSelected(dx: number, dy: number): void {
  const selected = [
    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
  ].filter(Boolean) as HTMLElement[];
  selected.forEach((node) => {
    node.style.left = `${node.offsetLeft + dx}px`;
    node.style.top = `${node.offsetTop + dy}px`;
  });
  telemetry('render-card-layer', { moved: state.selection.cardIds });
  telemetry('render-zone-layer', { moved: state.selection.zoneIds });
  telemetry('render-group-layer', { moved: state.selection.groupIds });
  renderRelationshipOverlay();
}
