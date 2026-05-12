import { wait } from './wait.mjs';
import { browserDistanceToRect } from './browser-distance-to-rect.mjs';
import { browserEndpointChecks } from './browser-endpoint-checks.mjs';
import { browserInside } from './browser-inside.mjs';
import { browserLoadTab } from './browser-load-tab.mjs';
import { browserParsePath } from './browser-parse-path.mjs';
import { browserRect } from './browser-rect.mjs';
import { browserReadOverviewDetail } from './browser-read-overview-detail.mjs';
import { browserScreenRect } from './browser-screen-rect.mjs';
import { browserSegmentHits } from './browser-segment-hits.mjs';
import { browserSelectFirstLedgerGroup } from './browser-select-first-ledger-group.mjs';
import { browserWaitFrame } from './browser-wait-frame.mjs';
import { waitLiveCanvasReady } from './wait-live-canvas-ready.mjs';

export async function readLiveAppState(send, url) {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await wait(900);
  await waitLiveCanvasReady(send);
  await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();' });
  await wait(900);
  await waitLiveCanvasReady(send);
  const corruptedGeometryRecovery = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function seedCorruptGeometry() {
      localStorage.setItem('corev2.canvas.state', JSON.stringify({
        viewport: { x: 0, y: 0, scale: 1 },
        selection: { cardIds: [], zoneIds: [], groupIds: [] },
        activeTab: 'surface',
        geometry: {
          cards: {
            'card-boot': { x: 120, y: 300, width: 42, height: 38 },
            'card-zone': { x: 420, y: 190, width: 39, height: 35 },
            'card-ledger': { x: 420, y: 555, width: 44, height: 36 }
          }
        }
      }));
      location.reload();
      return true;
    })()`
  });
  await wait(900);
  await waitLiveCanvasReady(send);
  const corruptedGeometryReport = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function readCorruptGeometryRecovery() {
      const cards = [...document.querySelectorAll('[data-card-id]')].map(function cardSize(card) {
        return {
          id: card.dataset.cardId,
          width: card.offsetWidth,
          height: card.offsetHeight,
          scrollHeight: card.scrollHeight,
          contentFits: card.scrollHeight <= card.offsetHeight + 1
        };
      });
      return {
        corruptGeometrySeeded: ${Boolean(corruptedGeometryRecovery.result.result.value)},
        corruptGeometryRecovered: cards.every(function cardRecovered(card) {
          return card.width >= 250 && card.height >= 126 && card.contentFits;
        }),
        recoveredCardSizes: cards
      };
    })()`
  });
  await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();' });
  await wait(900);
  await waitLiveCanvasReady(send);
  const honeycomb = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(function readHoneycombAndLedgerUrls() {
      const grid = document.querySelector('.grid');
      const canvas = document.querySelector('.canvas');
      const beforeStyle = getComputedStyle(grid);
      const before = beforeStyle.backgroundSize;
      const beforePosition = beforeStyle.backgroundPosition;
      const beforeRect = grid.getBoundingClientRect();
      const beforeViewportScale = window.__coreState.viewport.scale;
      canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 700, clientY: 320, deltaY: -120 }));
      const afterStyle = getComputedStyle(grid);
      const after = afterStyle.backgroundSize;
      const afterPosition = afterStyle.backgroundPosition;
      const afterRect = grid.getBoundingClientRect();
      const afterViewportScale = window.__coreState.viewport.scale;
      return Promise.all([
        fetch('/specs').then(function specsText(response) { return response.text(); }),
        fetch('/data').then(function dataText(response) { return response.text(); }),
        fetch('/blueprinttool/specs').then(function specsJson(response) { return response.json(); }),
        fetch('/blueprinttool/data').then(function dataJson(response) { return response.json(); }),
        fetch('/blueprinttool/state').then(function stateJson(response) { return response.json(); })
      ]).then(function honeycombReport(values) {
        const specsRoute = values[0];
        const dataRoute = values[1];
        const specsLedger = values[2];
        const dataLedger = values[3];
        const blueprintState = values[4];
        return {
        honeycombScaleStable: before === after,
        honeycombPositionStable: beforePosition === afterPosition,
        honeycombWorldScaleFollowsZoom: afterRect.width > beforeRect.width && afterRect.height > beforeRect.height,
        honeycombViewportScaleBefore: beforeViewportScale,
        honeycombViewportScaleAfter: afterViewportScale,
        honeycombRenderedWidthBefore: beforeRect.width,
        honeycombRenderedWidthAfter: afterRect.width,
        honeycombBackgroundSizeBefore: before,
        honeycombBackgroundSizeAfter: after,
        honeycombBackgroundPositionBefore: beforePosition,
        honeycombBackgroundPositionAfter: afterPosition,
        specsUrlLoadsApp: specsRoute.includes('Core Canvas') && specsRoute.includes('data-tab="specs"'),
        dataUrlLoadsApp: dataRoute.includes('Core Canvas') && dataRoute.includes('data-tab="data"'),
        blueprintSpecsAvailable: Array.isArray(specsLedger.cards) && specsLedger.cards.length > 0,
        blueprintDataAvailable: Boolean(dataLedger.modelName || dataLedger.cards || dataLedger.positions),
        blueprintStateTabs: (blueprintState.tabs ?? []).map(function blueprintTabId(tab) { return tab.id; })
      };
      });
    })()`
  });
  await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();' });
  await wait(900);
  await waitLiveCanvasReady(send);
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async function readInteractiveCanvasState() {
      ${browserParsePath}
      ${browserRect}
      ${browserScreenRect}
      ${browserInside}
      ${browserDistanceToRect}
      ${browserSegmentHits}
      ${browserEndpointChecks}
      ${browserWaitFrame}
      ${browserLoadTab}
      ${browserSelectFirstLedgerGroup}
      ${browserReadOverviewDetail}
      const specsTabLoad = await browserLoadTab('specs');
      const dataTabLoad = await browserLoadTab('data');
      const ledgerGroupSelection = await browserSelectFirstLedgerGroup();
      document.querySelector('[data-tab="surface"]').click();
      await browserWaitFrame();
      const surfaceRestoredAfterLedgerTabs = document.querySelector('[data-card-id="card-boot"]')?.hidden === false && document.querySelectorAll('.ledger-node').length === 0;
      const card = document.querySelector('[data-card-id="card-zone"]');
      const bootCard = document.querySelector('[data-card-id="card-boot"]');
      const group = document.querySelector('[data-group-id="group-core"]');
      const zone = document.querySelector('[data-zone-id="zone-frontend"]');
      const backendZone = document.querySelector('[data-zone-id="zone-backend"]');
      const ledgerCard = document.querySelector('[data-card-id="card-ledger"]');
      const resizeHandle = zone.querySelector('.resize-handle.nw');
      const groupResizeHandle = group.querySelector('.resize-handle.se');
      const frontendZoneColor = getComputedStyle(zone).getPropertyValue('--zone-color').trim();
      const backendZoneColor = getComputedStyle(backendZone).getPropertyValue('--zone-color').trim();
      const bootCardZoneColor = getComputedStyle(bootCard).getPropertyValue('--card-zone-color').trim();
      const ledgerCardZoneColor = getComputedStyle(ledgerCard).getPropertyValue('--card-zone-color').trim();
      const zoneColorCardsOk = bootCardZoneColor === frontendZoneColor && ledgerCardZoneColor === backendZoneColor;
      const telemetryStart = window.__coreTelemetry.length;
      const telemetryPanelHidden = document.querySelector('.telemetry-panel').hidden;
      const threadInitiallyHidden = document.querySelector('.thread-panel').hidden;
      const beforeCardMove = browserRect(bootCard);
      bootCard.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 32, clientY: bootCard.getBoundingClientRect().top + 32, pointerId: 10 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 92, clientY: bootCard.getBoundingClientRect().top + 77, pointerId: 10 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 92, clientY: bootCard.getBoundingClientRect().top + 77, pointerId: 10 }));
      const afterCardMove = browserRect(bootCard);
      const persistedCard = JSON.parse(localStorage.getItem('corev2.canvas.state')).geometry.cards['card-boot'];
      bootCard.style.left = '33px';
      bootCard.style.top = '44px';
      document.querySelector('[data-action="refresh"]').click();
      await new Promise(function resolveRefreshWait(resolve) { setTimeout(resolve, 180); });
      const afterRefresh = browserRect(bootCard);
      const refreshRestoredCard = afterRefresh.left === persistedCard.x && afterRefresh.top === persistedCard.y;
      card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: card.getBoundingClientRect().left + 32, clientY: card.getBoundingClientRect().top + 32, pointerId: 19 }));
      card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: card.getBoundingClientRect().left + 32, clientY: card.getBoundingClientRect().top + 32, pointerId: 19 }));
      const bidirectionalConnectedCards = {
        bootConnected: bootCard.classList.contains('connected'),
        ledgerConnected: document.querySelector('[data-card-id="card-ledger"]').classList.contains('connected')
      };
      const connectedCardGlowOk = getComputedStyle(bootCard).boxShadow !== 'none' && getComputedStyle(document.querySelector('[data-card-id="card-ledger"]')).boxShadow !== 'none';
      window.__coreState.selection = { cardIds: [], zoneIds: [], groupIds: [] };
      document.querySelector('.thread-panel').hidden = true;
      card.querySelector('[data-action="open-card-thread"]').click();
      const cardThreadText = document.querySelector('.thread-target').textContent;
      const cardNotesOpenedThreadFromUnselected = !document.querySelector('.thread-panel').hidden && window.__coreState.selection.cardIds.includes('card-zone');
      zone.querySelector('[data-action="edit-zone"]').click();
      const inlineEditActive = document.activeElement === zone.querySelector('.zone-title') && zone.querySelector('.zone-title').isContentEditable;
      zone.querySelector('.zone-title').blur();
      zone.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: zone.getBoundingClientRect().left + 24, clientY: zone.getBoundingClientRect().top + 24, pointerId: 11 }));
      zone.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: zone.getBoundingClientRect().left + 24, clientY: zone.getBoundingClientRect().top + 24, pointerId: 11 }));
      const zoneSelected = zone.classList.contains('selected');
      const beforeResize = browserRect(zone);
      resizeHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: zone.getBoundingClientRect().left, clientY: zone.getBoundingClientRect().top, pointerId: 12 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: zone.getBoundingClientRect().left + 400, clientY: zone.getBoundingClientRect().top + 400, pointerId: 12 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: zone.getBoundingClientRect().left + 400, clientY: zone.getBoundingClientRect().top + 400, pointerId: 12 }));
      const afterResize = browserRect(zone);
      document.querySelector('[data-tool="group"]').click();
      const grid = document.querySelector('.grid');
      const canvasScreenForGroupDraft = document.querySelector('.canvas').getBoundingClientRect();
      const expectedGroupDraftOrigin = { x: 760 - canvasScreenForGroupDraft.left, y: 190 - canvasScreenForGroupDraft.top };
      grid.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 760, clientY: 190, pointerId: 13 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 950, clientY: 360, pointerId: 13 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 950, clientY: 360, pointerId: 13 }));
      const createdGroup = document.querySelector('[data-group-id^="group-draft-"]');
      const createdGroupRect = createdGroup ? browserRect(createdGroup) : null;
      const createdGroupOriginAnchored = createdGroupRect
        ? Math.abs(createdGroupRect.left - expectedGroupDraftOrigin.x) <= 2 && Math.abs(createdGroupRect.top - expectedGroupDraftOrigin.y) <= 2
        : false;
      const groupToolResetAfterPlacement = window.__coreState.activeTool === 'select';
      const beforeGroupPanViewport = { ...window.__coreState.viewport };
      window.__coreState.selection = { cardIds: [], zoneIds: [], groupIds: [] };
      group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().left + 24, clientY: group.getBoundingClientRect().top + 24, pointerId: 15 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: group.getBoundingClientRect().left + 84, clientY: group.getBoundingClientRect().top + 24, pointerId: 15 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().left + 84, clientY: group.getBoundingClientRect().top + 24, pointerId: 15 }));
      const unselectedGroupPanMovedViewport = window.__coreState.viewport.x !== beforeGroupPanViewport.x || window.__coreState.viewport.y !== beforeGroupPanViewport.y;
      const unselectedGroupPanDidNotSelect = window.__coreState.selection.groupIds.length === 0;
      group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().left + 24, clientY: group.getBoundingClientRect().top + 24, pointerId: 16 }));
      group.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().left + 24, clientY: group.getBoundingClientRect().top + 24, pointerId: 16 }));
      const groupSelected = group.classList.contains('selected');
      const computedGroupMembership = { cardIds: [...window.__coreState.selection.cardIds], zoneIds: [...window.__coreState.selection.zoneIds], groupIds: [...window.__coreState.selection.groupIds] };
      const beforeGroupMove = browserRect(group);
      group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().left + 24, clientY: group.getBoundingClientRect().top + 24, pointerId: 17 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: group.getBoundingClientRect().left + 64, clientY: group.getBoundingClientRect().top + 54, pointerId: 17 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().left + 64, clientY: group.getBoundingClientRect().top + 54, pointerId: 17 }));
      const afterGroupMove = browserRect(group);
      groupResizeHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().right, clientY: group.getBoundingClientRect().bottom, pointerId: 18 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: group.getBoundingClientRect().right + 60, clientY: group.getBoundingClientRect().bottom + 40, pointerId: 18 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().right + 60, clientY: group.getBoundingClientRect().bottom + 40, pointerId: 18 }));
      const afterGroupResize = browserRect(group);
      document.querySelector('[data-tool="select"]').click();
      grid.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 980, clientY: 120, pointerId: 14 }));
      grid.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 980, clientY: 120, pointerId: 14 }));
      const backgroundClearedSelection = window.__coreState.selection.cardIds.length === 0 && window.__coreState.selection.zoneIds.length === 0 && window.__coreState.selection.groupIds.length === 0;
      const backgroundClearedFocus = document.activeElement === document.body;
      const path = document.querySelector('[data-relationship-id="rel-zone-ledger"]');
      const points = browserParsePath(path.getAttribute('d'));
      const sourceRect = browserRect(document.querySelector('[data-card-id="card-zone"]'));
      const targetRect = browserRect(document.querySelector('[data-card-id="card-ledger"]'));
      const sourceInteriorHit = points.slice(0, -1).some(function sourceSegmentHits(point, index) { return browserSegmentHits(point, points[index + 1], sourceRect); });
      const targetInteriorHit = points.slice(0, -1).some(function targetSegmentHits(point, index) { return browserSegmentHits(point, points[index + 1], targetRect); });
      const sourceEndpointDistance = browserDistanceToRect(points[0], sourceRect);
      const targetEndpointDistance = browserDistanceToRect(points[points.length - 1], targetRect);
      const sourceBorderStandoff = sourceEndpointDistance >= 4 && sourceEndpointDistance <= 16 && !browserInside(points[0], sourceRect);
      const targetBorderStandoff = targetEndpointDistance >= 4 && targetEndpointDistance <= 16 && !browserInside(points[points.length - 1], targetRect);
      const relationshipEndpointChecks = browserEndpointChecks('[data-relationship-id]');
      const beforeCloseRouteStyles = {
        zoneLeft: card.style.left,
        zoneTop: card.style.top,
        ledgerLeft: ledgerCard.style.left,
        ledgerTop: ledgerCard.style.top
      };
      card.style.left = '420px';
      card.style.top = '430px';
      ledgerCard.style.left = String(card.offsetLeft + card.offsetWidth + 20) + 'px';
      ledgerCard.style.top = '430px';
      await import('/src/runtime/function/render-relationship-overlay.ts').then(function renderCloseRelationship(module) { module.renderRelationshipOverlay(); });
      const closePath = document.querySelector('[data-relationship-id="rel-zone-ledger"]');
      const closePoints = browserParsePath(closePath.getAttribute('d'));
      let closeMinimumSegment = Number.POSITIVE_INFINITY;
      for (let pointIndex = 0; pointIndex < closePoints.length - 1; pointIndex += 1) {
        const segment = Math.abs(closePoints[pointIndex].x - closePoints[pointIndex + 1].x) + Math.abs(closePoints[pointIndex].y - closePoints[pointIndex + 1].y);
        if (segment < closeMinimumSegment) closeMinimumSegment = segment;
      }
      const closeRelationshipCheck = browserEndpointChecks('[data-relationship-id="rel-zone-ledger"]')[0];
      const closeRelationshipOk = closeRelationshipCheck.ok && closeMinimumSegment >= 24;
      card.style.left = beforeCloseRouteStyles.zoneLeft;
      card.style.top = beforeCloseRouteStyles.zoneTop;
      ledgerCard.style.left = beforeCloseRouteStyles.ledgerLeft;
      ledgerCard.style.top = beforeCloseRouteStyles.ledgerTop;
      await import('/src/runtime/function/render-relationship-overlay.ts').then(function restoreRelationship(module) { module.renderRelationshipOverlay(); });
      const canvasScreen = document.querySelector('.canvas').getBoundingClientRect();
      const clippedCards = [...document.querySelectorAll('[data-card-id]')]
        .map(function cardScreenRect(element) { return { id: element.dataset.cardId, rect: browserScreenRect(element) }; })
        .filter(function clippedCard(item) { return item.rect.left < canvasScreen.left || item.rect.right > canvasScreen.right || item.rect.top < canvasScreen.top || item.rect.bottom > canvasScreen.bottom; });
      const overviewDetail = await browserReadOverviewDetail();
      return {
        cardThreadText,
        specsTabLoad,
        dataTabLoad,
        ledgerGroupSelection,
        surfaceRestoredAfterLedgerTabs,
        cardNotesOpenedThreadFromUnselected,
        inlineEditActive,
        telemetryPanelHidden,
        threadInitiallyHidden,
        beforeCardMove,
        afterCardMove,
        persistedCard,
        refreshRestoredCard,
        bidirectionalConnectedCards,
        connectedCardGlowOk,
        zoneColorCardsOk,
        bootCardZoneColor,
        frontendZoneColor,
        ledgerCardZoneColor,
        backendZoneColor,
        zoneSelected,
        beforeResize,
        afterResize,
        createdGroup: createdGroupRect,
        expectedGroupDraftOrigin,
        createdGroupOriginAnchored,
        groupToolResetAfterPlacement,
        unselectedGroupPanMovedViewport,
        unselectedGroupPanDidNotSelect,
        groupSelected,
        computedGroupMembership,
        beforeGroupMove,
        afterGroupMove,
        afterGroupResize,
        backgroundClearedSelection,
        backgroundClearedFocus,
        relationshipPath: path.getAttribute('d'),
        sourceInteriorHit,
        targetInteriorHit,
        sourceEndpointDistance,
        targetEndpointDistance,
        sourceBorderStandoff,
        targetBorderStandoff,
        relationshipEndpointChecks,
        closeRelationshipOk,
        closeMinimumSegment,
        closeRelationshipCheck,
        clippedCards,
        overviewDetail,
        telemetry: window.__coreTelemetry.slice(telemetryStart).map(function telemetryEntry(entry) { return { name: entry.name, args: entry.args }; })
      };
    })()`
  });
  await send('Runtime.evaluate', { expression: 'location.reload();' });
  await wait(900);
  await waitLiveCanvasReady(send);
  await send('Runtime.evaluate', {
    expression: `(function seedViewportPersistence() {
      const record = JSON.parse(localStorage.getItem('corev2.canvas.state') ?? '{}');
      record.viewport = { x: -438, y: 217, scale: 0.63 };
      record.viewports = { ...(record.viewports ?? {}), surface: record.viewport };
      record.activeTab = 'surface';
      localStorage.setItem('corev2.canvas.state', JSON.stringify(record));
      location.reload();
    })()`
  });
  await wait(900);
  await waitLiveCanvasReady(send);
  const restored = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function readRestoredCardState() {
      const element = document.querySelector('[data-card-id="card-boot"]');
      return {
        restoredCard: { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight },
        viewportRefreshPreserved: window.__coreState.viewport.x === -438 && window.__coreState.viewport.y === 217 && window.__coreState.viewport.scale === 0.63,
        restoredViewport: { ...window.__coreState.viewport }
      };
    })()`
  });
  return { ...corruptedGeometryReport.result.result.value, ...honeycomb.result.result.value, ...result.result.result.value, ...restored.result.result.value };
}
