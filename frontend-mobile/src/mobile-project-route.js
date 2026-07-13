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
  const scope = parseProjectScope(pathname);
  if (!scope || scope.segments[0] !== 'projects') return null;
  if (scope.segments.length === 1) return { view: 'index', contextProjectId: scope.projectId, projectId: '' };
  if (scope.segments.length === 2 && scope.segments[1]) return { view: 'detail', contextProjectId: scope.projectId, projectId: scope.segments[1] };
  return { view: 'invalid', contextProjectId: scope.projectId, projectId: '' };
}

export function projectBasePath(projectId) {
  return `/p/${encodeURIComponent(projectId)}`;
}

export function projectPath(contextProjectId, projectId = '') {
  const base = `${projectBasePath(contextProjectId)}/projects`;
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
  return `${zonePathForProject(projectId, ledgerId, zoneId)}/cards/${encodeURIComponent(cardId)}`;
}
