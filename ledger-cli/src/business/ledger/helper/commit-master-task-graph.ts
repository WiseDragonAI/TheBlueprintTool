/**
 * WHAT: Requests one focused Git commit for the Markdown files owned by a discovered master-task graph.
 * WHY: callers should commit edited task documents without supplying project, ledger, or file paths.
 */
import type { Result } from '../../../lib/types.js';
import { resolveMasterTaskOwner } from './resolve-master-task-owner.js';

export async function commitMasterTaskGraph(input: { masterCardId?: string }): Promise<Result<string>> {
  const owner = await resolveMasterTaskOwner(input.masterCardId);
  // WHAT: stop before the commit request when master ownership is unresolved.
  // WHY: the master ID is the sole source of the owning repository and ledger context.
  if (!owner.ok) return owner;
  try {
    const response = await fetch(
      `${owner.value.serverUrl}/p/${encodeURIComponent(owner.value.projectId)}/api/task-content/master-task-commit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ masterCardId: owner.value.masterCardId, ledgerId: owner.value.ledgerId }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    // WHAT: preserve the server's focused Git rejection.
    // WHY: staged-owner conflicts and revision failures require explicit caller action, not an automatic retry.
    if (!response.ok) return { ok: false, error: `Master-task commit failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as {
      commit?: unknown;
      files?: unknown;
      ledgerId?: unknown;
      masterCardId?: unknown;
      projectId?: unknown;
    };
    const commit = String(payload.commit ?? '').trim();
    const files = Array.isArray(payload.files) ? payload.files.map(String) : [];
    // WHAT: reject incomplete commit evidence.
    // WHY: successful stdout must prove the exact revision and graph file inventory.
    if (!/^[a-f0-9]{40,64}$/.test(commit) || files.length === 0) {
      return { ok: false, error: 'Master-task commit returned incomplete Git evidence.' };
    }
    return {
      ok: true,
      value: JSON.stringify({
        version: 1,
        operation: 'master-task-commit',
        projectId: String(payload.projectId ?? owner.value.projectId),
        ledgerId: String(payload.ledgerId ?? owner.value.ledgerId),
        masterCardId: String(payload.masterCardId ?? owner.value.masterCardId),
        commit,
        files,
      }, null, 2),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task commit failed.' };
  }
}
