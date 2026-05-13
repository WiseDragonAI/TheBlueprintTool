import { editRegionColorController } from '../../zone/controller/edit-region-color-controller.js';

export function handleRegionColorInput(event: Event): void {
  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
  if (!input) return;
  const zone = input.closest('[data-zone-id]') as HTMLElement | null;
  editRegionColorController(zone, input.value);
}
