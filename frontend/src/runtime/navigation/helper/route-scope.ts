/**
 * WHAT: Parses the canonical global, project, ledger, and card route identity.
 * WHY: Compact and canvas presentations must consume one semantic URL contract.
 */
export type RouteScope = {
  view: 'control-room' | 'projects' | 'project' | 'ledgers' | 'ledger' | 'card' | 'settings' | 'skills' | 'pipelines' | 'unknown';
  projectId: string;
  ledgerId: string;
  zoneId: string;
  cardId: string;
};

function parts(path: string): string[] {
  try {
    return String(path ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return [];
  }
}

export function routeScope(path: string): RouteScope {
  const route = parts(path);
  const empty = { projectId: '', ledgerId: '', zoneId: '', cardId: '' };
  if (route.length === 0) return { view: 'control-room', ...empty };
  if (route[0] === 'projects' && route.length === 1) return { view: 'projects', ...empty };
  if (route[0] === 'projects' && route[1]) return { view: 'project', ...empty, projectId: route[1] };
  if (route[0] === 'ledgers' && route.length === 1) return { view: 'ledgers', ...empty };
  if (route[0] === 'settings') return { view: 'settings', ...empty };
  if (route[0] === 'skills') return { view: 'skills', ...empty };
  if (route[0] === 'pipelines') return { view: 'pipelines', ...empty };
  if (route[0] === 'p' && route[1] && route[2] === 'ledgers') {
    const base = { ...empty, projectId: route[1] };
    if (!route[3]) return { view: 'ledgers', ...base };
    if (route[4] === 'zones' && route[5] && route[6] === 'cards' && route[7]) {
      return { view: 'card', ...base, ledgerId: route[3], zoneId: route[5], cardId: route[7] };
    }
    return { view: 'ledger', ...base, ledgerId: route[3] };
  }
  // WHAT: Preserve direct legacy ledger URLs during migration.
  // WHY: Existing bookmarks should still load before being replaced with their canonical project route.
  if (route.length === 1) return { view: 'ledger', ...empty, ledgerId: route[0] };
  return { view: 'unknown', ...empty };
}

export function projectLedgersPath(projectId: string): string {
  return `/p/${encodeURIComponent(projectId)}/ledgers`;
}

export function projectLedgerPath(projectId: string, ledgerId: string): string {
  return `${projectLedgersPath(projectId)}/${encodeURIComponent(ledgerId)}`;
}
