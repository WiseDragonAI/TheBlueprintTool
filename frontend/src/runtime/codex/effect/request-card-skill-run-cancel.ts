/**
 * WHAT: Requests cancellation for one active card-scoped Codex skill run.
 * WHY: The widget stop button must delegate process ownership to the backend.
 */
export async function requestCardSkillRunCancel(input: { ledgerId: string; cardId: string; runId: string; executionId: string }): Promise<{ ok: boolean; status: string; error?: string }> {
  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ledgerId: input.ledgerId, cardId: input.cardId, executionId: input.executionId }),
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 'unknown', error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string; error?: string };
  return { ok: response.ok && body.ok !== false, status: String(body.status ?? 'unknown'), error: body.error };
}
