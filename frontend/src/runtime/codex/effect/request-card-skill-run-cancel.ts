/**
 * WHAT: Requests cancellation for one active card-scoped Codex skill run.
 * WHY: The widget stop button must delegate process ownership to the backend.
 */
import { projectReplicaRequestPath } from '../../project/helper/project-request-scope.js';

export async function requestCardSkillRunCancel(input: { projectId?: string; replicaNodeId?: string; ledgerId: string; cardId: string; runId: string; executionId: string }): Promise<{ ok: boolean; status: string; error?: string }> {
  const path = projectReplicaRequestPath(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/cancel`, String(input.projectId ?? ''), String(input.replicaNodeId ?? ''));
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ledgerId: input.ledgerId, cardId: input.cardId, executionId: input.executionId }),
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 'unknown', error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string; error?: string };
  return { ok: response.ok && body.ok !== false, status: String(body.status ?? 'unknown'), error: body.error };
}
