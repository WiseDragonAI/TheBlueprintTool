/**
 * WHAT: Resolves whether the current route is a real ledger or the ledgers overview.
 * WHY: `/ledgers` is a canvas mode, not a selectable ledger id.
 */
import { routeScope } from './route-scope.js';

export function routeCanvasMode(path: string): 'ledger' | 'ledgers' | 'projects' {
  const scope = routeScope(path);
  if (scope.view === 'projects') return 'projects';
  if (scope.view === 'ledgers') return 'ledgers';
  return 'ledger';
}
