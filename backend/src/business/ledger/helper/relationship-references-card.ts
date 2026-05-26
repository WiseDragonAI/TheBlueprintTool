/**
 * WHAT: Checks whether a ledger relationship references one card id.
 * WHY: Deleting a card must also remove relationship edges that would point at missing DOM nodes.
 */
export function relationshipReferencesCard(relationship: Record<string, unknown>, cardId: string): boolean {
  return [
    relationship.source,
    relationship.target,
    relationship.from,
    relationship.to,
    relationship.sourceId,
    relationship.targetId
  ].some((value) => String(value ?? '') === cardId);
}
