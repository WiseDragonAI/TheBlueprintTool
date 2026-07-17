let installed = false;

function pathnameOf(input: string): string {
  try {
    return new URL(input, globalThis.location?.origin ?? 'http://decision-os.local').pathname;
  } catch {
    return '';
  }
}

function globallyScoped(pathname: string): boolean {
  return pathname === '/decision-os/projects'
    || pathname.startsWith('/decision-os/projects/')
    || pathname === '/decision-os/projects-canvas'
    || pathname === '/api/control-room'
    || pathname === '/api/control-room-events'
    || pathname === '/api/codex/server-pipelines'
    || pathname.startsWith('/api/codex/server-pipelines/')
    || pathname === '/api/codex/server-skills'
    || pathname === '/api/federation/libraries/synchronize'
    || pathname === '/api/server/restart';
}

export function projectIdFromLocation(): string {
  const match = String(globalThis.location?.pathname ?? '').match(/^\/p\/([^/]+)(?:\/|$)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]).trim(); } catch { return ''; }
}

export function projectBasePath(value = projectIdFromLocation()): string {
  return value ? `/p/${encodeURIComponent(value)}` : '';
}

export function projectScopedRequestPath(input: string, value = projectIdFromLocation()): string {
  const path = String(input ?? '');
  const pathname = pathnameOf(path);
  if (!value || globallyScoped(pathname) || pathname.startsWith('/p/')) return path;
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/decision-os/') && !pathname.startsWith('/.decision-os/')) return path;
  if (/^https?:\/\//i.test(path)) {
    const parsed = new URL(path);
    if (globalThis.location?.origin && parsed.origin !== globalThis.location.origin) return path;
    parsed.pathname = `${projectBasePath(value)}${parsed.pathname}`;
    return parsed.toString();
  }
  const rootRelativePath = path.startsWith('.decision-os/') ? `/${path}` : path;
  return `${projectBasePath(value)}${rootRelativePath}`;
}

export function installProjectRequestScope(): void {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' || input instanceof URL) return nativeFetch(projectScopedRequestPath(String(input)), init);
    const scoped = projectScopedRequestPath(input.url);
    if (scoped === input.url) return nativeFetch(input, init);
    const requestInit: RequestInit & { duplex?: 'half' } = {
      method: input.method,
      headers: input.headers,
      body: input.body,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      referrer: input.referrer,
      referrerPolicy: input.referrerPolicy,
      integrity: input.integrity,
      keepalive: input.keepalive,
      signal: input.signal,
    };
    if (input.body) requestInit.duplex = 'half';
    return nativeFetch(new Request(scoped, requestInit), init);
  }) as typeof globalThis.fetch;
}
