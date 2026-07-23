/**
 * WHAT: Starts a backend Codex process for one active card thread.
 * WHY: The thread panel should delegate session ownership and card widget state to the server.
 */
export type ThreadCodexProcessRequest = {
  ledgerId: string;
  threadId: string;
  cardId: string;
  requestId?: string;
  codexModel?: string;
  codexEffort?: string;
};

export async function requestThreadCodexProcess(input: ThreadCodexProcessRequest): Promise<{ ok: boolean; run?: Record<string, unknown>; receipt?: Record<string, unknown>; queuePosition?: number | null; error?: string }> {
  const response = await fetch('/api/codex/threads/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as { ok?: boolean; run?: Record<string, unknown>; receipt?: Record<string, unknown>; queuePosition?: number | null; error?: string };
  return { ok: response.ok && body.ok !== false, run: body.run, receipt: body.receipt, queuePosition: body.queuePosition, error: body.error };
}
