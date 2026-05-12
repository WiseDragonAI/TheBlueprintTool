export function formatLiveSummary(report) {
  const relationshipChecks = [
    ...(report.relationshipEndpointChecks ?? []),
    ...(report.specsTabLoad?.relationshipEndpointChecks ?? []),
    ...(report.dataTabLoad?.relationshipEndpointChecks ?? [])
  ];
  const failedRelationships = [];
  for (const check of relationshipChecks) {
    if (!check.ok) failedRelationships.push(check);
  }
  const endpointEntries = [];
  for (const check of relationshipChecks) {
    endpointEntries.push({ key: `${check.sourceId}:${check.sourceSide}`, axis: check.sourceAxis, id: `${check.id}:source` });
    endpointEntries.push({ key: `${check.targetId}:${check.targetSide}`, axis: check.targetAxis, id: `${check.id}:target` });
  }
  let portSpreadWorstGap = Infinity;
  let portSpreadOk = true;
  let routeOverflowMax = 0;
  for (const check of relationshipChecks) {
    if ((check.routeOverflow ?? 0) > routeOverflowMax) routeOverflowMax = check.routeOverflow;
  }
  for (const entry of endpointEntries) {
    for (const candidate of endpointEntries) {
      if (entry.id >= candidate.id || entry.key !== candidate.key) continue;
      const gap = Math.abs(entry.axis - candidate.axis);
      if (gap < portSpreadWorstGap) portSpreadWorstGap = gap;
      if (gap < 18) portSpreadOk = false;
    }
  }
  if (portSpreadWorstGap === Infinity) portSpreadWorstGap = 0;
  const routeLoadingOk = report.specsUrlLoadsApp === true && report.dataUrlLoadsApp === true;
  const honeycombOk = report.honeycombWorldScaleFollowsZoom === true;
  const overviewOk = report.overviewDetail?.overviewDetail === true && report.overviewDetail?.zoneTitleHidden === true && report.overviewDetail?.cardTitleHidden === true && report.overviewDetail?.worldCoversCanvas === true;
  const lowDetailOk = report.overviewDetail?.lowDetailState?.lowDetail === true && report.overviewDetail?.lowDetailState?.zoneTitleHidden === true && report.overviewDetail?.lowDetailState?.cardTitleHidden === true;
  const lines = [
    `ok=${routeLoadingOk && honeycombOk && failedRelationships.length === 0 && report.ledgerGroupSelection?.ok === true && overviewOk && lowDetailOk && portSpreadOk}`,
    `specsUrlLoadsApp=${report.specsUrlLoadsApp}`,
    `dataUrlLoadsApp=${report.dataUrlLoadsApp}`,
    `tabs=${(report.blueprintStateTabs ?? []).join(',')}`,
    `honeycombWorldScaleFollowsZoom=${report.honeycombWorldScaleFollowsZoom}`,
    `relationshipsChecked=${relationshipChecks.length}`,
    `relationshipsFailed=${failedRelationships.length}`,
    `failedRelationshipIds=${failedRelationships.map(function failedRelationshipId(check) { return check.id; }).join(',')}`,
    `routeOverflowMax=${routeOverflowMax}`,
    `portSpreadOk=${portSpreadOk}`,
    `portSpreadWorstGap=${portSpreadWorstGap}`,
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
    `overviewOk=${overviewOk}`,
    `overviewWorldCoversCanvas=${report.overviewDetail?.worldCoversCanvas}`,
    `lowDetailOk=${lowDetailOk}`,
    `lowDetailScale=${report.overviewDetail?.lowDetailState?.viewportScale}`,
    `lowDetailZoneTitleHidden=${report.overviewDetail?.lowDetailState?.zoneTitleHidden}`,
    `lowDetailCardTitleHidden=${report.overviewDetail?.lowDetailState?.cardTitleHidden}`,
    `overviewScale=${report.overviewDetail?.viewportScale}`,
    `overviewZoneTitleHidden=${report.overviewDetail?.zoneTitleHidden}`,
    `overviewCardTitleHidden=${report.overviewDetail?.cardTitleHidden}`,
    `overviewCardBodyHidden=${report.overviewDetail?.cardBodyHidden}`,
    `threadVisibleAfterNotes=${report.cardNotesOpenedThreadFromUnselected}`
  ];
  return lines.join('\n');
}
