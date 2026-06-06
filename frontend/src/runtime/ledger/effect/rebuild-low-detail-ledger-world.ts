/**
 * WHAT: Rebuilds ledger card and zone world nodes as fresh DOM on the detail-to-low-detail edge.
 * WHY: The raster glitch survives branch teardown, so low-detail entry must discard detail-exposed world nodes themselves.
 */
import { content } from '../../dom.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { patchLedgerCard } from '../component/patch-ledger-card.js';
import { patchLedgerZone } from '../component/patch-ledger-zone.js';
import { ensureZoneAttributionCache } from '../helper/zone-attribution-cache.js';
import { state } from '../../state.js';

export function rebuildLowDetailLedgerWorld(): void {
  const ledger = state.activeLedger as { cards?: unknown; annotations?: unknown } | null;
  if (!ledger) return;
  const cards = Array.isArray(ledger.cards) ? ledger.cards as Array<Record<string, unknown>> : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations as Array<Record<string, unknown>> : [];
  const zoneAttribution = ensureZoneAttributionCache('rebuild-low-detail-ledger-world');

  for (const zone of annotations) {
    const id = String(zone.id ?? '');
    const selector = zone.variant === 'group' ? `[data-group-id="${CSS.escape(id)}"].ledger-node` : `[data-zone-id="${CSS.escape(id)}"].ledger-node`;
    const existing = content.querySelector(selector) as HTMLElement | null;
    if (!existing) continue;
    // Branch: Replace each zone node with a fresh element so the zone title does not retain detail-exposed browser state.
    existing.replaceWith(patchLedgerZone(zone, null));
  }

  for (const card of cards) {
    const id = String(card.id ?? '');
    const existing = content.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null;
    if (!existing) continue;
    // Branch: Replace each card shell with a fresh element so low-detail no longer reuses the detail-exposed world node.
    existing.replaceWith(patchLedgerCard(card, null, zoneAttribution?.cardById?.[id]));
  }

  renderSelectionState();
}
