/**
 * WHAT: Queues one skill followed by the current caller through the project-scoped execution API.
 * WHY: A running gate needs one explicit scheduling command without encoding its decision in model output.
 */
import type { Result } from '../../../lib/types.js';

type Request = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export async function queueSkill(
  input: { skillName?: string; codexModel?: string; codexEffort?: string },
  request: Request = fetch,
): Promise<Result<string>> {
  const skillName = String(input.skillName ?? '').trim();
  const codexModel = String(input.codexModel ?? '').trim();
  const codexEffort = String(input.codexEffort ?? '').trim();
  const executionId = String(process.env.DECISION_OS_EXECUTION_ID ?? '').trim();
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  if (!skillName || !codexModel || !codexEffort) {
    return { ok: false, error: 'queue-skill requires --skill, --model, and --effort.' };
  }
  if (!executionId || !projectId || !serverUrl) {
    return { ok: false, error: 'queue-skill requires the running Decision OS execution environment.' };
  }
  let response: Pick<Response, 'ok' | 'status' | 'text'>;
  try {
    response = await request(
      `${serverUrl}/p/${encodeURIComponent(projectId)}/api/codex/executions/${encodeURIComponent(executionId)}/queue-skill`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skillName, codexModel, codexEffort }),
      },
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const body = await response.text();
  if (!response.ok) return { ok: false, error: `Dynamic skill queue failed (${response.status}): ${body}` };
  return { ok: true, value: `Queued ${skillName}; the calling skill will run again after it completes.` };
}
