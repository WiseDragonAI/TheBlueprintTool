import { SVG_NS } from '../../dom.js';

export function createLedgerRelationshipOverlay(
  relationships: Array<Record<string, unknown>>,
  existing?: SVGSVGElement | null,
  bounds: { width: number; height: number } = { width: 5200, height: 2600 }
): SVGSVGElement {
  const overlay = existing ?? document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('relationships', 'ledger-relationships');
  overlay.setAttribute('width', String(bounds.width));
  overlay.setAttribute('height', String(bounds.height));
  overlay.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  overlay.style.width = `${bounds.width}px`;
  overlay.style.height = `${bounds.height}px`;
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
  marker.setAttribute('viewBox', '0 -5 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '0');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('markerUnits', 'strokeWidth');
  marker.setAttribute('orient', 'auto-start-reverse');
  let markerPath = marker.querySelector('path');
  if (!markerPath) {
    markerPath = document.createElementNS(SVG_NS, 'path');
    marker.append(markerPath);
  }
  markerPath.setAttribute('d', 'M 0 -4 L 10 0 L 0 4 z');
  const activeRelationshipIds = new Set<string>();
  const activeLabelIds = new Set<string>();
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
    path.dataset.relationshipLabelText = String(relationship.label ?? '');
    path.setAttribute('marker-end', 'url(#ledger-arrow)');
    path.setAttribute('marker-start', 'url(#ledger-arrow)');
    for (const kind of ['target', 'source']) {
      const labelId = `${id}:${kind}`;
      activeLabelIds.add(labelId);
      let label = overlay.querySelector(`[data-relationship-label="${labelId}"]`) as SVGTextElement | null;
      if (!label) {
        label = document.createElementNS(SVG_NS, 'text');
        overlay.append(label);
      }
      label.dataset.relationshipLabel = labelId;
      label.dataset.relationshipId = id;
      label.dataset.labelKind = kind;
      label.classList.toggle('is-target', kind === 'target');
      label.classList.toggle('is-source', kind === 'source');
      label.textContent = kind === 'target' ? String(relationship.label ?? '') : '';
    }
  }
  overlay.querySelectorAll('path[data-relationship-id]').forEach((node) => {
    if (!activeRelationshipIds.has((node as SVGPathElement).dataset.relationshipId ?? '')) node.remove();
  });
  overlay.querySelectorAll('[data-relationship-label]').forEach((node) => {
    if (!activeLabelIds.has((node as SVGTextElement).dataset.relationshipLabel ?? '')) node.remove();
  });
  return overlay;
}
