/**
 * WHAT: Requests a follow-up turn for one terminal card-scoped Codex skill run.
 * WHY: The widget should continue the run without exposing a destructive session-reset choice.
 */
import { projectReplicaRequestPath } from '../../project/helper/project-request-scope.js';

export async function requestCardSkillRunContinue(input: { projectId?: string; replicaNodeId?: string; ledgerId: string; cardId: string; runId: string; traceId?: string; codexModel?: string; codexEffort?: string }): Promise<{ ok: boolean; status: string; run?: Record<string, unknown>; queuePosition?: number | null; error?: string }> {
  const path = projectReplicaRequestPath(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/continue`, String(input.projectId ?? ''), String(input.replicaNodeId ?? ''));
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ledgerId: input.ledgerId,
      cardId: input.cardId,
      traceId: input.traceId,
      codexModel: input.codexModel,
      codexEffort: input.codexEffort,
    }),
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 'unknown', error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string; run?: Record<string, unknown>; queuePosition?: number | null; error?: string };
  return { ok: response.ok && body.ok !== false, status: String(body.status ?? body.run?.status ?? 'unknown'), run: body.run, queuePosition: body.queuePosition, error: body.error };
}
