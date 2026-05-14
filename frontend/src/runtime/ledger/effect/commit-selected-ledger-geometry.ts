import { state } from '../../state.js';
import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';

export async function commitSelectedLedgerGeometry(): Promise<void> {
  if (!state.activeLedger) return;
  const geometry = {
    cards: snapshotGeometry(state.selection.cardIds, 'data-card-id'),
    zones: snapshotGeometry(state.selection.zoneIds, 'data-zone-id'),
    groups: snapshotGeometry(state.selection.groupIds, 'data-group-id')
  };
  const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
  if (!hasGeometry) return;
  await commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true });
}

function snapshotGeometry(ids: string[], attr: string): Record<string, { x: number; y: number; width: number; height: number }> {
  return Object.fromEntries(ids.map((id) => {
    const element = document.querySelector(`[${attr}="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (!element) return undefined;
    return [id, { x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }];
  }).filter((entry): entry is [string, { x: number; y: number; width: number; height: number }] => Boolean(entry)));
}
