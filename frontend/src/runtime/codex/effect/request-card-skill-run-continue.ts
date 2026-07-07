/**
 * WHAT: Requests continuation for one terminal card-scoped Codex skill run.
 * WHY: The widget should resume the original Codex session with newer thread notes.
 */
export async function requestCardSkillRunContinue(input: { ledgerId: string; cardId: string; runId: string }): Promise<{ ok: boolean; status: string; run?: Record<string, unknown>; error?: string }> {
  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/continue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ledgerId: input.ledgerId, cardId: input.cardId }),
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 'unknown', error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string; run?: Record<string, unknown>; error?: string };
  return { ok: response.ok && body.ok !== false, status: String(body.status ?? body.run?.status ?? 'unknown'), run: body.run, error: body.error };
}
