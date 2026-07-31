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
    || pathname === '/api/diagnostics/frontend-telemetry-config'
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

export function replicaNodeIdFromLocation(): string {
  try { return new URLSearchParams(String(globalThis.location?.search ?? '')).get('replica')?.trim() ?? ''; }
  catch { return ''; }
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

export function projectReplicaRequestPath(input: string, projectId: string, replicaNodeId = ''): string {
  const scoped = projectScopedRequestPath(input, projectId);
  const replica = String(replicaNodeId).trim();
  if (!replica) return scoped;
  const hashIndex = scoped.indexOf('#');
  const path = hashIndex >= 0 ? scoped.slice(0, hashIndex) : scoped;
  const hash = hashIndex >= 0 ? scoped.slice(hashIndex) : '';
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}replica=${encodeURIComponent(replica)}${hash}`;
}

export function replicaRequestInit(init: RequestInit | undefined, replicaNodeId = '', baseHeaders?: HeadersInit): RequestInit | undefined {
  const replica = String(replicaNodeId).trim();
  if (!replica) return init;
  const headers = new Headers(baseHeaders);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('x-decision-os-replica-node', replica);
  return { ...init, headers };
}

export function installProjectRequestScope(): void {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const replicaNodeId = replicaNodeIdFromLocation();
    const withReplicaHeader = (requestInit: RequestInit | undefined, url: string, baseHeaders?: HeadersInit): RequestInit | undefined => pathnameOf(url).startsWith('/p/')
      ? replicaRequestInit(requestInit, replicaNodeId, baseHeaders)
      : requestInit;
    if (typeof input === 'string' || input instanceof URL) {
      const scoped = projectScopedRequestPath(String(input));
      return nativeFetch(scoped, withReplicaHeader(init, scoped));
    }
    const scoped = projectScopedRequestPath(input.url);
    if (scoped === input.url && (!replicaNodeId || !pathnameOf(scoped).startsWith('/p/'))) return nativeFetch(input, init);
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
    const request = new Request(scoped, requestInit);
    return nativeFetch(request, withReplicaHeader(init, scoped, input.headers));
  }) as typeof globalThis.fetch;
}
