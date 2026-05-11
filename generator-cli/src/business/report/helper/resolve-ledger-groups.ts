/**
 * WHAT: Resolves operator group names against SpecsLedger annotations.
 * WHY: check-ledger can target one or more named groups.
 */
import type { SpecsLedger, SpecsLedgerCard, SpecsLedgerGroup } from '../../../lib/types.js';

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function cardPosition(card: SpecsLedgerCard, specsLedger: SpecsLedger): { x: number; y: number } {
  const position = specsLedger.positions?.[card.id];
  return {
    x: position?.x ?? card.x ?? 0,
    y: position?.y ?? card.y ?? 0,
  };
}

function cardIsInsideGroup(card: SpecsLedgerCard, group: SpecsLedgerGroup, specsLedger: SpecsLedger): boolean {
  const position = cardPosition(card, specsLedger);
  return position.x >= group.x && position.x <= group.x + group.width && position.y >= group.y && position.y <= group.y + group.height;
}

export type ResolvedLedgerGroups = {
  allSpecCards: SpecsLedgerCard[];
  selectedSpecCards: SpecsLedgerCard[];
  selectedGroups: SpecsLedgerGroup[];
  unmatchedGroups: string[];
};

export function resolveLedgerGroups(specsLedger: SpecsLedger, groupNames: string[] = []): ResolvedLedgerGroups {
  const allSpecCards = (specsLedger.cards ?? []).filter((card) => card.cardType === 'spec-brief');

  if (groupNames.length === 0) {
    return { allSpecCards, selectedSpecCards: allSpecCards, selectedGroups: [], unmatchedGroups: [] };
  }

  const selectedGroups = (specsLedger.annotations ?? []).filter((annotation) => groupNames.map(normalized).includes(normalized(annotation.label)));
  const matchedGroupNames = new Set(selectedGroups.map((group) => normalized(group.label)));
  const unmatchedGroups = groupNames.filter((groupName) => !matchedGroupNames.has(normalized(groupName)));
  const selectedIds = new Set<string>();

  for (const group of selectedGroups) {
    for (const card of allSpecCards) {
      if (cardIsInsideGroup(card, group, specsLedger)) {
        selectedIds.add(card.id);
      }
    }
  }

  return {
    allSpecCards,
    selectedSpecCards: allSpecCards.filter((card) => selectedIds.has(card.id)),
    selectedGroups,
    unmatchedGroups,
  };
}
