/**
 * WHAT: Runtime helper that applies persisted canvas geometry to DOM elements.
 * WHY: Durable geometry must restore positions without allowing corrupt dimensions to collapse cards.
 */
import { patchBox } from './patch-box.js';

type PersistedGeometryOptions = { minWidth?: number; minHeight?: number; applyHeight?: boolean };

export function applyPersistedGeometry(selector: string, key: string, source: Record<string, Record<string, number>> = {}, options: PersistedGeometryOptions = {}): void {
  document.querySelectorAll(selector).forEach((node) => {
    const element = node as HTMLElement;
    const record = source[element.dataset[key] ?? ''];
    if (!record) return;
    const width = Math.max(options.minWidth ?? 1, Number(record.width));
    const height = Math.max(options.minHeight ?? 1, Number(record.height));
    if (options.applyHeight === false) {
      element.style.left = `${Number(record.x)}px`;
      element.style.top = `${Number(record.y)}px`;
      element.style.width = `${width}px`;
      element.style.removeProperty('height');
      return;
    }
    patchBox(element, Number(record.x), Number(record.y), width, height);
  });
}
