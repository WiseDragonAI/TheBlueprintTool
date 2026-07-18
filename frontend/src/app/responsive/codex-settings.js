/**
 * WHAT: Owns responsive Codex process-capacity settings behavior.
 * WHY: Mobile and desktop settings must share one validated server contract.
 */
export const codexProcessLimitRange = { minimum: 1, maximum: 32 };

export function validateCodexProcessLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < codexProcessLimitRange.minimum || parsed > codexProcessLimitRange.maximum) {
    throw new Error(`Maximum concurrent Codex processes must be an integer from ${codexProcessLimitRange.minimum} to ${codexProcessLimitRange.maximum}.`);
  }
  return parsed;
}

export async function loadCodexProcessSettings(fetchImpl) {
  const response = await fetchImpl('/api/settings/codex-processes', { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

export async function saveCodexProcessSettings(fetchImpl, value, voicePipelineId = '', masterTaskCompletionPipelineId = '') {
  const maxConcurrentCodexProcesses = validateCodexProcessLimit(value);
  const response = await fetchImpl('/api/settings/codex-processes', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ maxConcurrentCodexProcesses, voicePipelineId, masterTaskCompletionPipelineId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

export function stepCodexProcessLimit(value, delta) {
  const current = validateCodexProcessLimit(value);
  return Math.min(codexProcessLimitRange.maximum, Math.max(codexProcessLimitRange.minimum, current + Math.sign(delta)));
}
