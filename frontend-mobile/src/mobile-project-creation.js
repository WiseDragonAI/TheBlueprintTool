/**
 * WHAT: Creates one initialized project through the global project catalog endpoint.
 * WHY: The projects surface needs a testable request contract independent of route rendering.
 */
export async function createProjectRequest({ fetchImpl, name, description }) {
  const response = await fetchImpl('/decision-os/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: String(name ?? '').trim(), description: String(description ?? '').trim() })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false || !payload?.project?.id) {
    throw new Error(payload?.error || `Project creation failed with HTTP ${response.status}.`);
  }
  return payload.project;
}
