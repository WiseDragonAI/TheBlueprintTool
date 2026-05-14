import { content } from '../../dom.js';
import { state } from '../../state.js';
import { createLedgerRelationshipOverlay } from '../../relationship/component/create-ledger-relationship-overlay.js';
import { patchLedgerCard } from '../component/patch-ledger-card.js';
import { patchLedgerZone } from '../component/patch-ledger-zone.js';
import { setCanvasLayerHidden } from '../../canvas/effect/set-canvas-layer-hidden.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderLedgerSurface(): void {
  const ledger = state.activeLedger as { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>>; relationships?: Array<Record<string, unknown>> } | null;
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
  for (const zone of ledger.annotations ?? []) {
    const id = String(zone.id ?? '');
    activeZoneIds.add(id);
    const selector = zone.variant === 'group' ? `[data-group-id="${CSS.escape(id)}"].ledger-node` : `[data-zone-id="${CSS.escape(id)}"].ledger-node`;
    const node = patchLedgerZone(zone, content.querySelector(selector) as HTMLElement | null);
    if (!node.parentElement) content.insertBefore(node, marquee);
  }
  for (const card of ledger.cards ?? []) {
    const id = String(card.id ?? '');
    activeCardIds.add(id);
    const node = patchLedgerCard(card, content.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null);
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
  const overlay = createLedgerRelationshipOverlay(ledger.relationships ?? [], content.querySelector('.ledger-relationships') as SVGSVGElement | null, ledgerRelationshipBounds(ledger));
  if (!overlay.parentElement) content.insertBefore(overlay, marquee);
  telemetry('render-ledger-surface', { activeTab: state.activeTab, cards: ledger.cards?.length ?? 0, zones: ledger.annotations?.length ?? 0, relationships: ledger.relationships?.length ?? 0 });
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
