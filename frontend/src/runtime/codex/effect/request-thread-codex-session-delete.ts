/**
 * WHAT: Requests deletion of the Codex session owned by one card thread.
 * WHY: A fresh launch requires the backend to clear both run ownership and artifacts.
 */
export async function requestThreadCodexSessionDelete(input: { ledgerId: string; cardId: string; runId: string }): Promise<{ ok: boolean; status: string; error?: string }> {
  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ledgerId: input.ledgerId, cardId: input.cardId }),
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 'unknown', error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string; error?: string };
  return { ok: response.ok && body.ok !== false, status: String(body.status ?? 'unknown'), error: body.error };
}
