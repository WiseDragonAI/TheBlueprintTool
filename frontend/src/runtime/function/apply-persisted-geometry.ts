import { patchBox } from './patch-box.js';

export function applyPersistedGeometry(selector: string, key: string, source: Record<string, Record<string, number>> = {}): void {
  document.querySelectorAll(selector).forEach((node) => {
    const element = node as HTMLElement;
    const record = source[element.dataset[key] ?? ''];
    if (!record) return;
    patchBox(element, Number(record.x), Number(record.y), Number(record.width), Number(record.height));
  });
}
