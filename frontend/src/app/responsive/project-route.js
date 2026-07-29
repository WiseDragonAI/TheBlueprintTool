/**
 * WHAT: Parses and builds canonical project, ledger, zone, and card routes.
 * WHY: Responsive views and the desktop canvas must share resource identities.
 */
function parts(pathname) {
  try { return String(pathname ?? '').split('/').filter(Boolean).map(decodeURIComponent); }
  catch { return []; }
}

export function parseProjectScope(pathname) {
  const route = parts(pathname);
  if (route[0] !== 'p' || !route[1]) return null;
  return { projectId: route[1], segments: route.slice(2) };
}

export function parseProjectRoute(pathname) {
  const route = parts(pathname);
  if (route[0] !== 'projects') return null;
  if (route.length === 1) return { view: 'index', projectId: '' };
  if (route.length === 2 && route[1]) return { view: 'detail', projectId: route[1] };
  return { view: 'invalid', projectId: '' };
}

export function isProjectCardPath(pathname) {
  const scope = parseProjectScope(pathname);
  const segments = scope?.segments ?? [];
  return segments[0] === 'ledgers'
    && Boolean(segments[1])
    && (
      (segments[2] === 'cards' && Boolean(segments[3]))
      || (segments[2] === 'zones' && Boolean(segments[3]) && segments[4] === 'cards' && Boolean(segments[5]))
    );
}

export function projectBasePath(projectId) {
  return `/p/${encodeURIComponent(projectId)}`;
}

export function projectPath(projectId = '') {
  const base = '/projects';
  return projectId ? `${base}/${encodeURIComponent(projectId)}` : base;
}

export function ledgerPathForProject(projectId, ledgerId = '') {
  const base = `${projectBasePath(projectId)}/ledgers`;
  return ledgerId ? `${base}/${encodeURIComponent(ledgerId)}` : base;
}

export function zonePathForProject(projectId, ledgerId, zoneId) {
  return `${ledgerPathForProject(projectId, ledgerId)}/zones/${encodeURIComponent(zoneId)}`;
}

export function cardPathForProject(projectId, ledgerId, zoneId, cardId) {
  const resolvedCardId = cardId ?? zoneId;
  return `${ledgerPathForProject(projectId, ledgerId)}/cards/${encodeURIComponent(resolvedCardId)}`;
}
