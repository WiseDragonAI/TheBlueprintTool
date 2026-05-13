import { SVG_NS } from '../../dom.js';

export function createLedgerRelationshipOverlay(relationships: Array<Record<string, unknown>>, existing?: SVGSVGElement | null): SVGSVGElement {
  const overlay = existing ?? document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('relationships', 'ledger-relationships');
  overlay.setAttribute('role', 'img');
  overlay.setAttribute('aria-label', 'Ledger relationships');
  let defs = overlay.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    overlay.append(defs);
  }
  let marker = defs.querySelector('#ledger-arrow') as SVGMarkerElement | null;
  if (!marker) {
    marker = document.createElementNS(SVG_NS, 'marker');
    defs.append(marker);
  }
  marker.id = 'ledger-arrow';
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '4.5');
  marker.setAttribute('markerHeight', '4.5');
  marker.setAttribute('orient', 'auto');
  let markerPath = marker.querySelector('path');
  if (!markerPath) {
    markerPath = document.createElementNS(SVG_NS, 'path');
    marker.append(markerPath);
  }
  markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  const activeRelationshipIds = new Set<string>();
  for (const relationship of relationships) {
    const id = String(relationship.id ?? `${relationship.from}-${relationship.to}`);
    activeRelationshipIds.add(id);
    let path = overlay.querySelector(`[data-relationship-id="${id}"]`) as SVGPathElement | null;
    if (!path) {
      path = document.createElementNS(SVG_NS, 'path');
      overlay.append(path);
    }
    path.dataset.relationshipId = id;
    path.dataset.source = String(relationship.from ?? relationship.source ?? '');
    path.dataset.target = String(relationship.to ?? relationship.target ?? '');
    path.setAttribute('marker-end', 'url(#ledger-arrow)');
    let label = overlay.querySelector(`[data-relationship-label="${id}"]`) as SVGTextElement | null;
    if (!label) {
      label = document.createElementNS(SVG_NS, 'text');
      overlay.append(label);
    }
    label.dataset.relationshipLabel = id;
    label.textContent = String(relationship.label ?? '');
  }
  overlay.querySelectorAll('[data-relationship-id]').forEach((node) => {
    if (!activeRelationshipIds.has((node as SVGPathElement).dataset.relationshipId ?? '')) node.remove();
  });
  overlay.querySelectorAll('[data-relationship-label]').forEach((node) => {
    if (!activeRelationshipIds.has((node as SVGTextElement).dataset.relationshipLabel ?? '')) node.remove();
  });
  return overlay;
}
