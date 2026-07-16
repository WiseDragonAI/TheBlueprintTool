import { state } from '../../state.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
import { routeScope } from './route-scope.js';

export function routeTab(path: string): string {
  const tab = routeScope(path).ledgerId;
  const tabs = activeLedgers().map((entry: { id: string }) => entry.id);
  return tabs.includes(tab) ? tab : tabs[0] ?? 'specs';
}
