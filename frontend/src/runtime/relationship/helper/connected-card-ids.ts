import { telemetry } from '../../telemetry/effect/telemetry.js';

export function connectedCardIds(cardIds: string[]): string[] {
  const selected = new Set(cardIds);
  const connected = new Set<string>();
  document.querySelectorAll('[data-relationship-id]').forEach((node) => {
    const path = node as SVGPathElement;
    const source = path.dataset.source ?? '';
    const target = path.dataset.target ?? '';
    if (selected.has(source) && target) connected.add(target);
    if (selected.has(target) && source) connected.add(source);
  });
  const resolved = [...connected].filter((cardId) => !selected.has(cardId));
  telemetry('resolve-connected-cards', { specId: '6000000b', cardIds, connectedCardIds: resolved });
  return resolved;
}
