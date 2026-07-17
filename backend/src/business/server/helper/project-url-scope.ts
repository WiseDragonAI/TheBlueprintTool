export type ProjectUrlScope = { projectId: string; scopedPath: string };

export function parseProjectUrlScope(pathname: string): ProjectUrlScope | null {
  const match = String(pathname ?? '').match(/^\/p\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  try {
    const projectId = decodeURIComponent(match[1]).trim();
    return projectId ? { projectId, scopedPath: match[2] || '/' } : null;
  } catch {
    return null;
  }
}

export function isGlobalProjectEndpoint(pathname: string): boolean {
  return pathname === '/decision-os/projects'
    || pathname.startsWith('/decision-os/projects/')
    || pathname === '/decision-os/projects-canvas'
    || pathname === '/api/control-room-events'
    || pathname === '/api/codex/server-pipelines'
    || pathname.startsWith('/api/codex/server-pipelines/')
    || pathname === '/api/codex/server-skills'
    || pathname === '/api/server/restart';
}

export function isProjectSensitiveEndpoint(pathname: string): boolean {
  return pathname.startsWith('/decision-os/')
    || pathname.startsWith('/api/')
    || pathname.startsWith('/.decision-os/');
}
