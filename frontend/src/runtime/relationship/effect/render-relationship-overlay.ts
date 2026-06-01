import { SVG_NS } from '../../dom.js';
import { state } from '../../state.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { activeLedgerCardMap, activeLedgerCardRectMap } from '../../ledger/helper/active-ledger-geometry.js';
import { ensureZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { calculateRelationshipPorts } from '../helper/calculate-relationship-ports.js';
import { resolveRelationshipPortSlots } from '../helper/resolve-relationship-port-slots.js';
import { routeRelationshipPath } from '../helper/route-relationship-path.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderRelationshipOverlay(): void {
  const overlays = Array.from(document.querySelectorAll('.relationships')) as SVGSVGElement[];
  let count = 0;
  for (const overlay of overlays) {
    if (overlay.hasAttribute('hidden')) continue;
    const relationships = Array.from(overlay.querySelectorAll('path[data-relationship-id]')) as SVGPathElement[];
    count += state.activeLedger
      ? renderLedgerRelationshipOverlay(overlay, relationships)
      : renderStaticRelationshipOverlay(overlay, relationships);
  }
  telemetry('render-relationship-overlay', { count });
}

function renderLedgerRelationshipOverlay(overlay: SVGSVGElement, relationships: SVGPathElement[]): number {
  const rectByCardId = activeLedgerCardRectMap();
  const cardById = activeLedgerCardMap();
  const zoneAttribution = ensureZoneAttributionCache('render-relationship-overlay');
  const endpoints = relationships.map((path) => ({
    relationshipId: path.dataset.relationshipId ?? '',
    sourceId: path.dataset.source ?? '',
    targetId: path.dataset.target ?? ''
  })).filter((relationship) => relationship.relationshipId && relationship.sourceId && relationship.targetId);
  const portSlots = resolveRelationshipPortSlots(endpoints, rectByCardId);
  let count = 0;
  for (const [routeIndex, path] of relationships.entries()) {
    const relationshipId = path.dataset.relationshipId ?? '';
    const sourceId = path.dataset.source ?? '';
    const targetId = path.dataset.target ?? '';
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!sourceRect || !targetRect) continue;
    const ports = calculateRelationshipPorts(sourceRect, targetRect, portSlots[relationshipId], { sourceId, targetId });
    const route = routeRelationshipPath({ ...ports, routeIndex });
    path.setAttribute('d', route.path);
    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
    const sourceTitle = String(cardById.get(sourceId)?.title ?? sourceId);
    patchRelationshipLabel(overlay, relationshipId, 'target', relationshipLabel, route.startLabel, relationshipLabelColor(sourceId, zoneAttribution?.cardById?.[sourceId]?.readableColor));
    patchRelationshipLabel(overlay, relationshipId, 'source', sourceTitle, route.endLabel, relationshipLabelColor(targetId, zoneAttribution?.cardById?.[targetId]?.readableColor));
    count += 1;
  }
  return count;
}

function renderStaticRelationshipOverlay(overlay: SVGSVGElement, relationships: SVGPathElement[]): number {
  const rectByCardId = new Map<string, { left: number; top: number; right: number; bottom: number; width: number; height: number }>();
  const sourceTitleById = new Map<string, string>();
  for (const path of relationships) {
    for (const cardId of [path.dataset.source ?? '', path.dataset.target ?? '']) {
      if (!cardId || rectByCardId.has(cardId)) continue;
      const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
      if (!element || element.hidden) continue;
      rectByCardId.set(cardId, elementCanvasRect(element));
      sourceTitleById.set(cardId, element.querySelector('strong')?.textContent?.trim() || cardId);
    }
  }
  const endpoints = relationships.map((path) => ({
    relationshipId: path.dataset.relationshipId ?? '',
    sourceId: path.dataset.source ?? '',
    targetId: path.dataset.target ?? ''
  })).filter((relationship) => relationship.relationshipId && relationship.sourceId && relationship.targetId);
  const portSlots = resolveRelationshipPortSlots(endpoints, rectByCardId);
  let count = 0;
  for (const [routeIndex, path] of relationships.entries()) {
    const relationshipId = path.dataset.relationshipId ?? '';
    const sourceId = path.dataset.source ?? '';
    const targetId = path.dataset.target ?? '';
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!sourceRect || !targetRect) continue;
    const ports = calculateRelationshipPorts(sourceRect, targetRect, portSlots[relationshipId], { sourceId, targetId });
    const route = routeRelationshipPath({ ...ports, routeIndex });
    path.setAttribute('d', route.path);
    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
    const sourceTitle = sourceTitleById.get(sourceId) || sourceId;
    patchRelationshipLabel(overlay, relationshipId, 'target', relationshipLabel, route.startLabel, relationshipLabelColor(sourceId));
    patchRelationshipLabel(overlay, relationshipId, 'source', sourceTitle, route.endLabel, relationshipLabelColor(targetId));
    count += 1;
  }
  return count;
}

function relationshipLabelColor(_cardId: string, readableColor?: string): string {
  return readableColor?.trim()
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
