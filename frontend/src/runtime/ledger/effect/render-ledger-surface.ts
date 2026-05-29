import { content } from '../../dom.js';
import { state } from '../../state.js';
import { createLedgerRelationshipOverlay } from '../../relationship/component/create-ledger-relationship-overlay.js';
import { scheduleLedgerCardTabFrameSync } from '../../card/effect/schedule-ledger-card-tab-frame-sync.js';
import { watchLedgerCardTabFrameSize } from '../../card/effect/watch-ledger-card-tab-frame-size.js';
import { patchLedgerCard } from '../component/patch-ledger-card.js';
import { patchLedgerZone } from '../component/patch-ledger-zone.js';
import { setCanvasLayerHidden } from '../../canvas/effect/set-canvas-layer-hidden.js';
import { ensureZoneAttributionCache } from '../helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { invalidateDetailModeCardSizeCache } from '../../canvas/effect/update-detail-mode.js';

export function renderLedgerSurface(): void {
  invalidateDetailModeCardSizeCache();
  const ledger = state.activeLedger as { cards?: unknown; annotations?: unknown; relationships?: unknown } | null;
  const isLedgerTab = Boolean(ledger);
  content.querySelectorAll(':scope > .card:not(.ledger-node), :scope > .zone:not(.ledger-node), :scope > .relationships:not(.ledger-relationships)').forEach((node) => {
    setCanvasLayerHidden(node, isLedgerTab);
  });
  if (!ledger) {
    content.querySelectorAll('.ledger-node, .ledger-relationships').forEach((node) => node.remove());
    telemetry('render-ledger-surface', { activeTab: state.activeTab, mode: 'static' });
    return;
  }
  const marquee = content.querySelector('.marquee');
  const activeZoneIds = new Set<string>();
  const activeCardIds = new Set<string>();
  const cards = Array.isArray(ledger.cards) ? ledger.cards as Array<Record<string, unknown>> : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations as Array<Record<string, unknown>> : [];
  const relationships = Array.isArray(ledger.relationships) ? ledger.relationships as Array<Record<string, unknown>> : [];
  const zoneAttribution = ensureZoneAttributionCache('render-ledger-surface');
  for (const zone of annotations) {
    const id = String(zone.id ?? '');
    activeZoneIds.add(id);
    const selector = zone.variant === 'group' ? `[data-group-id="${CSS.escape(id)}"].ledger-node` : `[data-zone-id="${CSS.escape(id)}"].ledger-node`;
    const node = patchLedgerZone(zone, content.querySelector(selector) as HTMLElement | null);
    if (!node.parentElement) content.insertBefore(node, marquee);
  }
  for (const card of cards) {
    const id = String(card.id ?? '');
    activeCardIds.add(id);
    const node = patchLedgerCard(card, content.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null, zoneAttribution?.cardById?.[id]);
    if (!node.parentElement) content.insertBefore(node, marquee);
  }
  content.querySelectorAll('.ledger-node[data-zone-id]').forEach((node) => {
    if (!activeZoneIds.has((node as HTMLElement).dataset.zoneId ?? '')) node.remove();
  });
  content.querySelectorAll('.ledger-node[data-group-id]').forEach((node) => {
    if (!activeZoneIds.has((node as HTMLElement).dataset.groupId ?? '')) node.remove();
  });
  content.querySelectorAll('.ledger-node[data-card-id]').forEach((node) => {
    if (!activeCardIds.has((node as HTMLElement).dataset.cardId ?? '')) node.remove();
  });
  const overlay = createLedgerRelationshipOverlay(relationships, content.querySelector('.ledger-relationships') as SVGSVGElement | null, ledgerRelationshipBounds({ cards, annotations }));
  if (!overlay.parentElement) content.insertBefore(overlay, marquee);
  scheduleLedgerCardTabFrameSync(content);
  watchLedgerCardTabFrameSize(content);
  telemetry('render-ledger-surface', { activeTab: state.activeTab, cards: cards.length, zones: annotations.length, relationships: relationships.length });
}

function ledgerRelationshipBounds(ledger: { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>> }): { width: number; height: number } {
  const padX = 420;
  const padY = 320;
  let width = 1200;
  let height = 760;
  for (const card of ledger.cards ?? []) {
    width = Math.max(width, Number(card.x ?? 0) + Number(card.w ?? 280) + padX);
    height = Math.max(height, Number(card.y ?? 0) + Number(card.h ?? 180) + padY);
  }
  for (const annotation of ledger.annotations ?? []) {
    width = Math.max(width, Number(annotation.x ?? 0) + Number(annotation.width ?? 0) + padX);
    height = Math.max(height, Number(annotation.y ?? 0) + Number(annotation.height ?? 0) + padY);
  }
  return { width, height };
}
