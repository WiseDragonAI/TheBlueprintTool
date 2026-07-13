let projectId = '';
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
    || pathname === '/api/server/restart';
}

export function projectBasePath(value = projectId): string {
  return value ? `/p/${encodeURIComponent(value)}` : '';
}

export function setProjectRequestProjectId(value: string): void {
  projectId = String(value ?? '').trim();
}

export function projectScopedRequestPath(input: string, value = projectId): string {
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
  return `${projectBasePath(value)}${path}`;
}

export function installProjectRequestScope(): void {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' || input instanceof URL) return nativeFetch(projectScopedRequestPath(String(input)), init);
    const scoped = projectScopedRequestPath(input.url);
    return nativeFetch(scoped === input.url ? input : new Request(scoped, input), init);
  }) as typeof globalThis.fetch;
}
