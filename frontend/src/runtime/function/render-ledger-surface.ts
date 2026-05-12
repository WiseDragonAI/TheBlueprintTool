import { content } from '../dom.js';
import { state } from '../state.js';
import { createLedgerRelationshipOverlay } from './create-ledger-relationship-overlay.js';
import { patchLedgerCard } from './patch-ledger-card.js';
import { patchLedgerZone } from './patch-ledger-zone.js';
import { setCanvasLayerHidden } from './set-canvas-layer-hidden.js';
import { telemetry } from './telemetry.js';

export function renderLedgerSurface(): void {
  const ledger = state.activeLedger as { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>>; relationships?: Array<Record<string, unknown>> } | null;
  const isLedgerTab = Boolean(ledger);
  content.querySelectorAll('.ledger-node, .ledger-relationships').forEach((node) => node.remove());
  content.querySelectorAll(':scope > .card:not(.ledger-node), :scope > .zone:not(.ledger-node), :scope > .relationships:not(.ledger-relationships)').forEach((node) => {
    setCanvasLayerHidden(node, isLedgerTab);
  });
  if (!ledger) {
    telemetry('render-ledger-surface', { activeTab: state.activeTab, mode: 'static' });
    return;
  }
  const marquee = content.querySelector('.marquee');
  for (const zone of ledger.annotations ?? []) content.insertBefore(patchLedgerZone(zone), marquee);
  for (const card of ledger.cards ?? []) content.insertBefore(patchLedgerCard(card), marquee);
  content.insertBefore(createLedgerRelationshipOverlay(ledger.relationships ?? []), marquee);
  telemetry('render-ledger-surface', { activeTab: state.activeTab, cards: ledger.cards?.length ?? 0, zones: ledger.annotations?.length ?? 0, relationships: ledger.relationships?.length ?? 0 });
}
