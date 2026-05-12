import { SVG_NS } from '../dom.js';
import { calculateRelationshipPorts } from './calculate-relationship-ports.js';
import { resolveRelationshipPortSlots } from './resolve-relationship-port-slots.js';
import { routeRelationshipPath } from './route-relationship-path.js';
import { telemetry } from './telemetry.js';

export function renderRelationshipOverlay(): void {
  const overlays = Array.from(document.querySelectorAll('.relationships')) as SVGSVGElement[];
  let count = 0;
  for (const overlay of overlays) {
    if (overlay.hasAttribute('hidden') || getComputedStyle(overlay).display === 'none') continue;
    const relationships = Array.from(overlay.querySelectorAll('[data-relationship-id]')) as SVGPathElement[];
    const portSlots = resolveRelationshipPortSlots(relationships);
    for (const [routeIndex, path] of relationships.entries()) {
      const source = document.querySelector(`[data-card-id="${path.dataset.source}"]`) as HTMLElement | null;
      const target = document.querySelector(`[data-card-id="${path.dataset.target}"]`) as HTMLElement | null;
      if (!source || !target || source.hidden || target.hidden) continue;
      const ports = calculateRelationshipPorts(source, target, portSlots[path.dataset.relationshipId ?? '']);
      const route = routeRelationshipPath({ ...ports, routeIndex });
      path.setAttribute('d', route.path);
      path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
      let label = overlay.querySelector(`[data-relationship-label="${path.dataset.relationshipId}"]`) as SVGTextElement | null;
      if (!label) {
        label = document.createElementNS(SVG_NS, 'text');
        label.dataset.relationshipLabel = path.dataset.relationshipId;
        label.textContent = path.dataset.relationshipId === 'rel-boot-zone' ? 'hydrates' : 'persists';
        overlay.appendChild(label);
      }
      label.setAttribute('x', String(route.label.x));
      label.setAttribute('y', String(route.label.y));
      count += 1;
    }
  }
  telemetry('render-relationship-overlay', { count });
}
