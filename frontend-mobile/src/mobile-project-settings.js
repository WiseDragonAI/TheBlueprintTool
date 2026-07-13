export function projectSettingsValues(project) {
  return {
    name: String(project?.name ?? ''),
    description: String(project?.description ?? ''),
    color: String(project?.color ?? '#38d9e8'),
  };
}

export async function saveProjectSettingsRequest({ fetchImpl, projects, projectId, values }) {
  const response = await fetchImpl(`/decision-os/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.project) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return {
    project: payload.project,
    projects: projects.map((entry) => entry.id === payload.project.id ? payload.project : entry),
  };
}
