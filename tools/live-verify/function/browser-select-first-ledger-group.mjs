export const browserSelectFirstLedgerGroup = `
async function browserSelectFirstLedgerGroup() {
  await browserLoadTab('data');
  const group = document.querySelector('.ledger-node[data-group-id]');
  if (!group) return { ok: false, reason: 'missing-ledger-group' };
  const rect = group.getBoundingClientRect();
  const x = rect.left + Math.min(24, rect.width / 2);
  const y = rect.top + Math.min(24, rect.height / 2);
  group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 31 }));
  group.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 31 }));
  await browserWaitFrame();
  const selectedGroup = document.querySelector('.ledger-node[data-group-id="' + group.dataset.groupId + '"]');
  const zoneIds = [...window.__coreState.selection.zoneIds];
  const cardIds = [...window.__coreState.selection.cardIds];
  const groupIds = [...window.__coreState.selection.groupIds];
  const selectedZones = [...document.querySelectorAll('.ledger-node[data-zone-id].selected')].map(function selectedLedgerZone(zone) {
    return zone.dataset.zoneId;
  });
  const selectedCards = [...document.querySelectorAll('.ledger-node[data-card-id].selected')].map(function selectedLedgerCard(card) {
    return card.dataset.cardId;
  });
  return {
    ok: selectedGroup?.classList.contains('selected') && zoneIds.length > 0 && selectedZones.length === zoneIds.length,
    groupId: group.dataset.groupId,
    groupIds,
    zoneIds,
    cardIds,
    selectedZones,
    selectedCards,
    groupHasZoneId: Boolean(group.dataset.zoneId)
  };
}
`;
