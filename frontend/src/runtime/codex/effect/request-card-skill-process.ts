/**
 * WHAT: Starts a backend Codex skill process for one card.
 * WHY: The UI should delegate output card creation and process ownership to the server.
 */
export async function requestCardSkillProcess(input: { ledgerId: string; cardId: string; skillName: string }): Promise<{ ok: boolean; run?: Record<string, unknown>; error?: string }> {
  const response = await fetch('/api/codex/skills/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; run?: Record<string, unknown>; error?: string };
  return { ok: response.ok && body.ok !== false, run: body.run, error: body.error };
}
