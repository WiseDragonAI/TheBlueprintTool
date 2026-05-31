import { editRegionColorController, previewRegionColorController } from '../../zone/controller/edit-region-color-controller.js';

export function handleRegionColorInput(event: Event): void {
  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
  if (!input) return;
  const zone = input.dataset.zoneId
    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
    : input.closest('[data-zone-id]') as HTMLElement | null;
  previewRegionColorController(zone, input.value);
}

export function handleRegionColorChange(event: Event): void {
  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
  if (!input) return;
  const zone = input.dataset.zoneId
    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
    : input.closest('[data-zone-id]') as HTMLElement | null;
  editRegionColorController(zone, input.value);
}
