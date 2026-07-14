/**
 * WHAT: Starts a backend Codex skill process for one card.
 * WHY: The UI should delegate output card creation and process ownership to the server.
 */
export type CardSkillProcessRequest = {
  ledgerId: string;
  cardId: string;
  skillName: string;
  codexModel?: string;
  codexEffort?: string;
};

export async function requestCardSkillProcess(input: CardSkillProcessRequest): Promise<{ ok: boolean; run?: Record<string, unknown>; queuePosition?: number | null; error?: string }> {
  const response = await fetch('/api/codex/skills/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; run?: Record<string, unknown>; queuePosition?: number | null; error?: string };
  return { ok: response.ok && body.ok !== false, run: body.run, queuePosition: body.queuePosition, error: body.error };
}
