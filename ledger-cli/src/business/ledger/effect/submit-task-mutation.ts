/**
 * WHAT: Submits one causal Tasks mutation through the project-scoped Decision OS worker.
 * WHY: Migrated Tasks ledgers reject aggregate JSON writes and require declared mutation commands.
 */
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;
type Request = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export function taskMutationEndpoint(): Result<string> {
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  if (!serverUrl || !projectId) {
    return { ok: false, error: 'Scoped task commands require `DECISION_OS_SERVER_URL` and `DECISION_OS_PROJECT_ID`.' };
  }
  return { ok: true, value: `${serverUrl}/p/${encodeURIComponent(projectId)}/decision-os/tasks` };
}

export async function submitTaskMutation(mutation: JsonObject, request: Request = fetch): Promise<Result<JsonObject>> {
  const endpoint = taskMutationEndpoint();
  if (!endpoint.ok) return endpoint;
  let response: Pick<Response, 'ok' | 'status' | 'text'>;
  try {
    response = await request(endpoint.value, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mutation),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const body = await response.text();
  if (!response.ok) return { ok: false, error: `Decision OS task mutation failed (${response.status}): ${body}` };
  try {
    const payload = JSON.parse(body) as unknown;
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ok: true, value: payload as JsonObject }
      : { ok: false, error: 'Decision OS task mutation returned a non-object response.' };
  } catch {
    return { ok: false, error: 'Decision OS task mutation returned invalid JSON.' };
  }
}
