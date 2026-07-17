/** WHAT: Loads and saves the redacted federation connection contract. */
export async function loadFederationSettings(fetchImpl) {
  const response = await fetchImpl('/api/settings/federation', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load federation settings (${response.status}).`);
  return response.json();
}

export async function saveFederationSettings(fetchImpl, value) {
  const response = await fetchImpl('/api/settings/federation', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw new Error(result.error || `Could not save federation settings (${response.status}).`);
  return result;
}
