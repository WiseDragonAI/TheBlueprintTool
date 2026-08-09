/**
 * WHAT: Attributes retained federation dirt to one deterministic collision-recovery receipt.
 * WHY: A predecessor hash on the same entity key must not suppress publication of the next causal successor.
 */
export function hasPendingFederationRepair(
  runtimeDirty: Array<{ projectId: string; entityKey: string; stateHash: string }>,
  projectId: string,
  resultingStateHashes: Record<string, string>,
): boolean {
  return runtimeDirty.some((entry) => (
    entry.projectId === projectId
    && resultingStateHashes[entry.entityKey] === entry.stateHash
  ));
}
