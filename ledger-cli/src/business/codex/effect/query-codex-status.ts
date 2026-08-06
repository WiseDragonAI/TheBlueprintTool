/**
 * WHAT: Queries the project-scoped status of one Decision OS Codex execution.
 * WHY: Running agents need zero-argument self-query and operators need explicit execution selection.
 */
import type { Result } from '../../../lib/types.js';

type Request = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

export async function queryCodexStatus(input: { executionId?: string; elapsed: boolean; context: boolean; limits: boolean; json: boolean }, request: Request = fetch): Promise<Result<string>> {
  const executionId = String(input.executionId ?? process.env.DECISION_OS_EXECUTION_ID ?? '').trim();
  const projectId = String(process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  const serverUrl = String(process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  // WHAT: Reject queries without the complete project and execution address.
  // WHY: Provider usage must never be discovered through global session scanning.
  if (!executionId || !projectId || !serverUrl) return { ok: false, error: 'codex-status requires an execution id and the Decision OS project environment.' };
  try {
    const response = await request(`${serverUrl}/p/${encodeURIComponent(projectId)}/api/task-executions/${encodeURIComponent(executionId)}/codex-status`);
    const body = await response.text();
    // WHAT: Preserve the backend's stable scoped error response.
    // WHY: CLI callers need the HTTP status and exact server evidence.
    if (!response.ok) return { ok: false, error: `Codex status query failed (${response.status}): ${body}` };
    const payload = JSON.parse(body) as { status: Record<string, unknown> };
    const selected = input.elapsed || input.context || input.limits;
    const value: Record<string, unknown> = { executionId: payload.status.executionId, phase: payload.status.phase, providerSession: payload.status.providerSession };
    // WHAT: Include elapsed data by default or when explicitly selected.
    // WHY: Selection flags narrow groups while identity remains stable.
    if (!selected || input.elapsed) value.elapsed = payload.status.elapsed;
    // WHAT: Include context data by default or when explicitly selected.
    // WHY: Unavailable context must remain visible without suppressing elapsed time.
    if (!selected || input.context) value.context = payload.status.context;
    // WHAT: Include limit data by default or when explicitly selected.
    // WHY: Every observed Codex limit window belongs to the limits group.
    if (!selected || input.limits) value.limits = payload.status.limits;
    // WHAT: Emit stable structured output when requested.
    // WHY: Agents consume JSON while terminal users retain a readable default.
    if (input.json) return { ok: true, value: JSON.stringify(value, null, 2) };
    return { ok: true, value: Object.entries(value).map(([key, entry]) => `${key}: ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`).join('\n') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
