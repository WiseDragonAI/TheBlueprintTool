/**
 * WHAT: Owns directory browsing and project creation requests for the projects surface.
 * WHY: Filesystem and lifecycle request contracts must remain testable outside route rendering.
 */
export async function loadProjectDirectoryRequest({ fetchImpl, path = '.' }) {
  const response = await fetchImpl(`/decision-os/directories?path=${encodeURIComponent(String(path || '.'))}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false || !payload?.listing?.absolutePath) {
    throw new Error(payload?.error || `Directory listing failed with HTTP ${response.status}.`);
  }
  return payload.listing;
}

export async function createProjectRequest({ fetchImpl, name, description, directory }) {
  const response = await fetchImpl('/decision-os/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: String(name ?? '').trim(),
      description: String(description ?? '').trim(),
      directory: String(directory ?? '').trim(),
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false || !payload?.project?.id) {
    throw new Error(payload?.error || `Project creation failed with HTTP ${response.status}.`);
  }
  return payload.project;
}
