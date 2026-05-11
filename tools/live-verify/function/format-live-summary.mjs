export function formatLiveSummary(report) {
  const failedRelationships = (report.relationshipEndpointChecks ?? []).filter(function failedRelationship(check) {
    return !check.ok;
  });
  const lines = [
    `ok=${failedRelationships.length === 0 && report.ledgerGroupSelection?.ok === true}`,
    `specsUrlLoadsApp=${report.specsUrlLoadsApp}`,
    `dataUrlLoadsApp=${report.dataUrlLoadsApp}`,
    `tabs=${(report.blueprintStateTabs ?? []).join(',')}`,
    `honeycombWorldScaleFollowsZoom=${report.honeycombWorldScaleFollowsZoom}`,
    `relationshipsChecked=${report.relationshipEndpointChecks?.length ?? 0}`,
    `relationshipsFailed=${failedRelationships.length}`,
    `staticGroupSelected=${report.groupSelected}`,
    `staticGroupZoneIds=${(report.computedGroupMembership?.zoneIds ?? []).join(',')}`,
    `staticGroupCardIds=${(report.computedGroupMembership?.cardIds ?? []).join(',')}`,
    `ledgerGroupOk=${report.ledgerGroupSelection?.ok}`,
    `ledgerGroupId=${report.ledgerGroupSelection?.groupId ?? ''}`,
    `ledgerGroupZoneCount=${report.ledgerGroupSelection?.zoneIds?.length ?? 0}`,
    `ledgerGroupCardCount=${report.ledgerGroupSelection?.cardIds?.length ?? 0}`,
    `ledgerGroupSelectedZones=${report.ledgerGroupSelection?.selectedZones?.length ?? 0}`,
    `ledgerGroupSelectedCards=${report.ledgerGroupSelection?.selectedCards?.length ?? 0}`,
    `ledgerGroupHasZoneId=${report.ledgerGroupSelection?.groupHasZoneId}`,
    `threadVisibleAfterNotes=${report.cardNotesOpenedThreadFromUnselected}`
  ];
  return lines.join('\n');
}
