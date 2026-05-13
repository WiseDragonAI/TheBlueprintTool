import { applyZoneColorEdit } from '../../zone/effect/apply-zone-color-edit.js';

export function handleRegionColorInput(event: Event): void {
  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
  if (!input) return;
  const zone = input.closest('[data-zone-id]') as HTMLElement | null;
  if (!zone) return;
  applyZoneColorEdit(zone, input.value);
}
