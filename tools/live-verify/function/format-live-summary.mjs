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
  const geometryRecoveryOk = report.corruptGeometryRecovered === true;
  const closeRelationshipOk = report.closeRelationshipOk === true;
  const zoneColorCardsOk = report.zoneColorCardsOk === true;
  const zoneFillTransparentOk = report.zoneFillReport?.ok === true;
  const zoneStackOk = report.staticZoneStackReport?.ok === true && report.ledgerZoneStackReport?.ok === true;
  const connectedCardGlowOk = report.connectedCardGlowOk === true;
  const viewportRefreshOk = report.viewportRefreshPreserved === true;
  const ledgerStaticOverlayOk = report.specsTabLoad?.staticRelationshipsHidden === true
    && report.dataTabLoad?.staticRelationshipsHidden === true
    && report.specsTabLoad?.staticRelationshipVisibleCount === 0
    && report.dataTabLoad?.staticRelationshipVisibleCount === 0;
  const overviewOk = report.overviewDetail?.overviewDetail === true && report.overviewDetail?.zoneTitleHidden === true && report.overviewDetail?.cardTitleVisible === true && report.overviewDetail?.cardTitleCounterScaled === true && report.overviewDetail?.worldCoversCanvas === true;
  const lowDetailOk = report.overviewDetail?.lowDetailState?.lowDetail === true && report.overviewDetail?.lowDetailState?.zoneTitleHidden === true && report.overviewDetail?.lowDetailState?.cardTitleVisible === true && report.overviewDetail?.lowDetailState?.cardTitleCounterScaled === true;
  const lines = [
    `ok=${routeLoadingOk && honeycombOk && geometryRecoveryOk && closeRelationshipOk && zoneColorCardsOk && zoneFillTransparentOk && zoneStackOk && connectedCardGlowOk && viewportRefreshOk && ledgerStaticOverlayOk && failedRelationships.length === 0 && report.ledgerGroupSelection?.ok === true && overviewOk && lowDetailOk && portSpreadOk}`,
    `specsUrlLoadsApp=${report.specsUrlLoadsApp}`,
    `dataUrlLoadsApp=${report.dataUrlLoadsApp}`,
    `tabs=${(report.blueprintStateTabs ?? []).join(',')}`,
    `honeycombWorldScaleFollowsZoom=${report.honeycombWorldScaleFollowsZoom}`,
    `corruptGeometryRecovered=${report.corruptGeometryRecovered}`,
    `closeRelationshipOk=${report.closeRelationshipOk}`,
    `closeRelationshipMinimumSegment=${report.closeMinimumSegment}`,
    `zoneColorCardsOk=${report.zoneColorCardsOk}`,
    `zoneFillTransparentOk=${zoneFillTransparentOk}`,
    `zoneFillBackgroundUsesAlpha=${report.zoneFillReport?.backgroundUsesAlpha}`,
    `zoneFillBackgroundAlpha=${report.zoneFillReport?.backgroundAlpha}`,
    `zoneStackOk=${zoneStackOk}`,
    `staticZoneStack=${JSON.stringify(report.staticZoneStackReport ?? {})}`,
    `ledgerZoneStack=${JSON.stringify(report.ledgerZoneStackReport ?? {})}`,
    `bootCardZoneColor=${report.bootCardZoneColor}`,
    `frontendZoneColor=${report.frontendZoneColor}`,
    `ledgerCardZoneColor=${report.ledgerCardZoneColor}`,
    `backendZoneColor=${report.backendZoneColor}`,
    `connectedCardGlowOk=${report.connectedCardGlowOk}`,
    `viewportRefreshPreserved=${report.viewportRefreshPreserved}`,
    `restoredViewport=${JSON.stringify(report.restoredViewport ?? {})}`,
    `ledgerStaticOverlayOk=${ledgerStaticOverlayOk}`,
    `specsStaticRelationshipVisibleCount=${report.specsTabLoad?.staticRelationshipVisibleCount}`,
    `dataStaticRelationshipVisibleCount=${report.dataTabLoad?.staticRelationshipVisibleCount}`,
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
    `lowDetailCardTitleVisible=${report.overviewDetail?.lowDetailState?.cardTitleVisible}`,
    `lowDetailCardTitleCounterScaled=${report.overviewDetail?.lowDetailState?.cardTitleCounterScaled}`,
    `overviewScale=${report.overviewDetail?.viewportScale}`,
    `overviewZoneTitleHidden=${report.overviewDetail?.zoneTitleHidden}`,
    `overviewCardTitleVisible=${report.overviewDetail?.cardTitleVisible}`,
    `overviewCardTitleCounterScaled=${report.overviewDetail?.cardTitleCounterScaled}`,
    `overviewCardBodyHidden=${report.overviewDetail?.cardBodyHidden}`,
    `threadVisibleAfterNotes=${report.cardNotesOpenedThreadFromUnselected}`
  ];
  return lines.join('\n');
}
