import { SVG_NS } from '../dom.js';

export function createLedgerRelationshipOverlay(relationships: Array<Record<string, unknown>>): SVGSVGElement {
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('relationships', 'ledger-relationships');
  overlay.setAttribute('viewBox', '-12000 -1200 18000 11000');
  overlay.setAttribute('role', 'img');
  overlay.setAttribute('aria-label', 'Ledger relationships');
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.id = 'ledger-arrow';
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto');
  const markerPath = document.createElementNS(SVG_NS, 'path');
  markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  marker.append(markerPath);
  defs.append(marker);
  overlay.append(defs);
  for (const relationship of relationships) {
    const path = document.createElementNS(SVG_NS, 'path');
    const id = String(relationship.id ?? `${relationship.from}-${relationship.to}`);
    path.dataset.relationshipId = id;
    path.dataset.source = String(relationship.from ?? relationship.source ?? '');
    path.dataset.target = String(relationship.to ?? relationship.target ?? '');
    path.setAttribute('marker-end', 'url(#ledger-arrow)');
    const label = document.createElementNS(SVG_NS, 'text');
    label.dataset.relationshipLabel = id;
    label.textContent = String(relationship.label ?? '');
    overlay.append(path, label);
  }
  return overlay;
}
