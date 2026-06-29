import { state } from '../../state.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';

export function routeTab(path: string): string {
  const tab = path.split('/').filter(Boolean)[0];
  const tabs = activeLedgers().map((entry: { id: string }) => entry.id);
  return tabs.includes(tab) ? tab : tabs[0] ?? 'specs';
}
