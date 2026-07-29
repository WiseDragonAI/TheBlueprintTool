/**
 * WHAT: Starts a backend Codex skill process for one card.
 * WHY: The UI should delegate output card creation and process ownership to the server.
 */
import type { CodexContentKind } from '../../../../../shared/schemas/codex-pipeline-types.js';

export type CardSkillProcessRequest = {
  ledgerId: string;
  cardId: string;
  skillName: string;
  contentKind?: CodexContentKind;
  requestId?: string;
  codexModel?: string;
  codexEffort?: string;
};

export async function requestCardSkillProcess(input: CardSkillProcessRequest): Promise<{ ok: boolean; run?: Record<string, unknown>; receipts?: readonly Record<string, unknown>[]; queuePosition?: number | null; error?: string }> {
  const response = await fetch('/api/codex/skills/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; run?: Record<string, unknown>; receipts?: Record<string, unknown>[]; queuePosition?: number | null; error?: string };
  return { ok: response.ok && body.ok !== false, run: body.run, receipts: body.receipts, queuePosition: body.queuePosition, error: body.error };
}
