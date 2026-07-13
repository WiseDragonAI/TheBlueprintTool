export function parseProjectRoute(pathname) {
  const parts = String(pathname ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== 'projects') return null;
  if (parts.length === 1) return { view: 'index', projectId: '' };
  if (parts.length === 2 && parts[1]) return { view: 'detail', projectId: parts[1] };
  return { view: 'invalid', projectId: '' };
}

export function projectPath(projectId = '') {
  return projectId ? `/projects/${encodeURIComponent(projectId)}` : '/projects';
}
