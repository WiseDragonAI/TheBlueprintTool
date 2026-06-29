/**
 * WHAT: Resolves whether the current route is a real ledger or the ledgers overview.
 * WHY: `/ledgers` is a canvas mode, not a selectable ledger id.
 */
export function routeCanvasMode(path: string): 'ledger' | 'ledgers' {
  return path.split('/').filter(Boolean)[0] === 'ledgers' ? 'ledgers' : 'ledger';
}
