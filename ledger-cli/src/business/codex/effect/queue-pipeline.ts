/**
 * WHAT: Queues one saved pipeline after the current thread execution.
 * WHY: A thread agent needs one execution-scoped command that preserves task ownership and predecessor ordering.
 */
import type { Result } from '../../../lib/types.js';

type Request = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export async function queuePipeline(
  input: { pipelineId?: string },
  request: Request = fetch,
): Promise<Result<string>> {
  const pipelineId = String(input.pipelineId ?? '').trim();
  const executionId = String(process.env.DECISION_OS_EXECUTION_ID ?? '').trim();
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  // WHAT: Require the exact saved-pipeline selection before issuing a request.
  // WHY: The server must never infer a successor from catalog order or display names.
  if (!pipelineId) {
    return { ok: false, error: 'queue-pipeline requires --pipeline.' };
  }
  // WHAT: Require the injected execution-scoped Decision OS environment.
  // WHY: The endpoint derives task ownership from the authenticated calling execution.
  if (!executionId || !projectId || !serverUrl) {
    return { ok: false, error: 'queue-pipeline requires the running Decision OS execution environment.' };
  }
  let response: Pick<Response, 'ok' | 'status' | 'text'>;
  try {
    response = await request(
      `${serverUrl}/p/${encodeURIComponent(projectId)}/api/codex/executions/${encodeURIComponent(executionId)}/queue-pipeline`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pipelineId }),
      },
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const body = await response.text();
  // WHAT: Preserve the server's scoped admission failure for the calling agent.
  // WHY: A rejected successor must not be reported as queued.
  if (!response.ok) return { ok: false, error: `Dynamic pipeline queue failed (${response.status}): ${body}` };
  return { ok: true, value: `Queued pipeline ${pipelineId} after the current thread execution.` };
}
