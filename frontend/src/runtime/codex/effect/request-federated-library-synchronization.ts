/**
 * WHAT: Requests one explicit skills-first federation library reconciliation.
 * WHY: Operators need a recovery action without reopening a library or reconnecting a node.
 */
export type FederatedLibrarySynchronizationResult = {
  ok: boolean;
  synchronizedPeerCount: number;
  error?: string;
};

export async function requestFederatedLibrarySynchronization(): Promise<FederatedLibrarySynchronizationResult> {
  const response = await fetch('/api/federation/libraries/synchronize', { method: 'POST' }).catch(() => undefined);
  if (!response) return { ok: false, synchronizedPeerCount: 0, error: 'Synchronization request failed.' };
  const body = await response.json().catch(() => null) as Partial<FederatedLibrarySynchronizationResult> | null;
  if (!body) return { ok: false, synchronizedPeerCount: 0, error: 'Synchronization returned an invalid response.' };
  const ok = response.ok && body.ok === true;
  return {
    ok,
    synchronizedPeerCount: Number.isInteger(body.synchronizedPeerCount) ? Number(body.synchronizedPeerCount) : 0,
    error: ok ? undefined : String(body.error ?? `Synchronization failed (${response.status}).`),
  };
}
