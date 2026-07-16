/**
 * WHAT: Provides typed global and project-scoped Decision OS requests.
 * WHY: Shared features must receive explicit resource identity without mutating global fetch behavior.
 */
export type ProjectSummary = {
  id: string; name: string; description: string; color: string; relativePath: string;
  available: boolean; diagnostic: string;
  ledgers: Array<{ id: string; title: string; ledgerFile: string }>;
};

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...init });
  const payload = await response.json().catch(() => null) as T & { error?: string } | null;
  // WHAT: Reject unsuccessful transport and application responses together.
  // WHY: Feature controllers need one recoverable error contract.
  if (!response.ok || !payload) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

export function projectPath(projectId: string, path: string): string {
  return `/p/${encodeURIComponent(projectId)}${path}`;
}

export async function readProjects(): Promise<ProjectSummary[]> {
  return (await requestJson<{ projects: ProjectSummary[] }>('/decision-os/projects')).projects;
}

export async function mutateProject(projectId: string, method: 'PATCH' | 'DELETE', body?: Record<string, unknown>): Promise<ProjectSummary> {
  const result = await requestJson<{ project: ProjectSummary }>(`/decision-os/projects/${encodeURIComponent(projectId)}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return result.project;
}

export async function createOrRegisterProject(body: { name?: string; description?: string; path?: string }): Promise<ProjectSummary> {
  return (await requestJson<{ project: ProjectSummary }>('/decision-os/projects', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })).project;
}

export async function mutateLedger(projectId: string, ledgerId: string, mutation: Record<string, unknown>): Promise<Record<string, unknown>> {
  return requestJson(projectPath(projectId, `/decision-os/${encodeURIComponent(ledgerId)}`), {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mutation),
  });
}
