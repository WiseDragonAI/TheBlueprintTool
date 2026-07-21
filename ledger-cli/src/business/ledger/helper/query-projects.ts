import type { Result } from '../../../lib/types.js';

type Project = { id: string; name: string };

function serverUrl(): Result<string> {
  const value = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  return value ? { ok: true, value } : { ok: false, error: 'projects requires DECISION_OS_SERVER_URL.' };
}

export async function queryProjects(): Promise<Result<string>> {
  const server = serverUrl();
  if (!server.ok) return server;
  try {
    const response = await fetch(`${server.value}/api/control-room?localOnly=1`);
    if (!response.ok) return { ok: false, error: `Project query failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as { projects?: Array<{ id?: unknown; name?: unknown }> };
    const projects: Project[] = (payload.projects ?? [])
      .map((project) => ({ id: String(project.id ?? '').trim(), name: String(project.name ?? '').trim() }))
      .filter((project) => project.id && project.name)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    return { ok: true, value: projects.map((project) => `${project.id}\t${project.name}`).join('\n') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Project query failed.' };
  }
}
