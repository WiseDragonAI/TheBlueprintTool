import { SVG_NS } from '../../dom.js';
import { calculateRelationshipPorts } from '../helper/calculate-relationship-ports.js';
import { resolveRelationshipPortSlots } from '../helper/resolve-relationship-port-slots.js';
import { routeRelationshipPath } from '../helper/route-relationship-path.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderRelationshipOverlay(): void {
  const overlays = Array.from(document.querySelectorAll('.relationships')) as SVGSVGElement[];
  let count = 0;
  for (const overlay of overlays) {
    if (overlay.hasAttribute('hidden') || getComputedStyle(overlay).display === 'none') continue;
    const relationships = Array.from(overlay.querySelectorAll('path[data-relationship-id]')) as SVGPathElement[];
    const portSlots = resolveRelationshipPortSlots(relationships);
    for (const [routeIndex, path] of relationships.entries()) {
      const source = document.querySelector(`[data-card-id="${path.dataset.source}"]`) as HTMLElement | null;
      const target = document.querySelector(`[data-card-id="${path.dataset.target}"]`) as HTMLElement | null;
      if (!source || !target || source.hidden || target.hidden) continue;
      const ports = calculateRelationshipPorts(source, target, portSlots[path.dataset.relationshipId ?? '']);
      const route = routeRelationshipPath({ ...ports, routeIndex });
      path.setAttribute('d', route.path);
      path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
      const relationshipId = path.dataset.relationshipId ?? '';
      const relationshipLabel = path.dataset.relationshipLabelText || path.dataset.relationshipId || '';
      const sourceTitle = source.querySelector('strong')?.textContent?.trim() || path.dataset.source || '';
      patchRelationshipLabel(overlay, relationshipId, 'target', relationshipLabel, route.startLabel, relationshipLabelColor(source));
      patchRelationshipLabel(overlay, relationshipId, 'source', sourceTitle, route.endLabel, relationshipLabelColor(target));
      count += 1;
    }
  }
  telemetry('render-relationship-overlay', { count });
}

function relationshipLabelColor(endpoint: HTMLElement): string {
  const style = getComputedStyle(endpoint);
  return endpoint.style.getPropertyValue('--card-readable-color').trim()
    || endpoint.style.getPropertyValue('--card-code-color').trim()
    || style.getPropertyValue('--card-readable-color').trim()
    || style.getPropertyValue('--card-code-color').trim()
    || style.getPropertyValue('--card-zone-color').trim()
    || 'rgba(243, 240, 231, 0.72)';
}

function patchRelationshipLabel(
  overlay: SVGSVGElement,
  relationshipId: string,
  kind: 'source' | 'target',
  text: string,
  point: { x: number; y: number; anchor?: string },
  color: string
): void {
  const labelId = `${relationshipId}:${kind}`;
  let label = overlay.querySelector(`[data-relationship-label="${labelId}"]`) as SVGTextElement | null;
  if (!label) {
    label = document.createElementNS(SVG_NS, 'text');
    label.dataset.relationshipLabel = labelId;
    label.dataset.relationshipId = relationshipId;
    label.dataset.labelKind = kind;
    overlay.appendChild(label);
  }
  label.classList.toggle('is-source', kind === 'source');
  label.classList.toggle('is-target', kind === 'target');
  label.textContent = text;
  label.setAttribute('x', String(point.x));
  label.setAttribute('y', String(point.y));
  label.setAttribute('text-anchor', point.anchor ?? 'middle');
  label.style.setProperty('--relationship-label-color', color);
}
