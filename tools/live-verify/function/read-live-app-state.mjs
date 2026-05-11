import { wait } from './wait.mjs';

export async function readLiveAppState(send, url) {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await wait(900);
  await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();' });
  await wait(900);
  const honeycomb = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const grid = document.querySelector('.grid');
      const canvas = document.querySelector('.canvas');
      const before = getComputedStyle(grid).backgroundSize;
      canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 700, clientY: 320, deltaY: -120 }));
      const after = getComputedStyle(grid).backgroundSize;
      return Promise.all([
        fetch('/specs').then((response) => response.text()),
        fetch('/data').then((response) => response.text()),
        fetch('/blueprinttool/specs').then((response) => response.json()),
        fetch('/blueprinttool/data').then((response) => response.json()),
        fetch('/blueprinttool/state').then((response) => response.json())
      ]).then(([specsRoute, dataRoute, specsLedger, dataLedger, blueprintState]) => ({
        honeycombScaleStable: before === after,
        honeycombBackgroundSizeBefore: before,
        honeycombBackgroundSizeAfter: after,
        specsUrlLoadsApp: specsRoute.includes('Core Canvas') && specsRoute.includes('data-tab="specs"'),
        dataUrlLoadsApp: dataRoute.includes('Core Canvas') && dataRoute.includes('data-tab="data"'),
        blueprintSpecsAvailable: Array.isArray(specsLedger.cards) && specsLedger.cards.length > 0,
        blueprintDataAvailable: Boolean(dataLedger.modelName || dataLedger.cards || dataLedger.positions),
        blueprintStateTabs: (blueprintState.tabs ?? []).map((tab) => tab.id)
      }));
    })()`
  });
  await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();' });
  await wait(900);
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async () => {
      const parsePath = (d) => d.match(/-?\\d+(?:\\.\\d+)?/g).map(Number).reduce((points, value, index, values) => {
        if (index % 2 === 0) points.push({ x: value, y: values[index + 1] });
        return points;
      }, []);
      const rect = (element) => ({ left: element.offsetLeft, top: element.offsetTop, right: element.offsetLeft + element.offsetWidth, bottom: element.offsetTop + element.offsetHeight, width: element.offsetWidth, height: element.offsetHeight });
      const screenRect = (element) => element.getBoundingClientRect().toJSON();
      const inside = (point, box) => point.x > box.left + 1 && point.x < box.right - 1 && point.y > box.top + 1 && point.y < box.bottom - 1;
      const segmentHits = (a, b, box) => {
        for (let step = 1; step < 20; step += 1) {
          const t = step / 20;
          if (inside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, box)) return true;
        }
        return false;
      };
      const waitFrame = () => new Promise((resolve) => setTimeout(resolve, 260));
      const loadTab = async (tabId) => {
        document.querySelector('[data-tab="' + tabId + '"]').click();
        await waitFrame();
        const cards = [...document.querySelectorAll('.ledger-node[data-card-id]')];
        return {
          tabId,
          route: location.pathname,
          activeTab: window.__coreState.activeTab,
          ledgerCardCount: cards.length,
          firstTitle: cards[0]?.querySelector('strong')?.textContent ?? '',
          staticSurfaceHidden: document.querySelector('[data-card-id="card-boot"]')?.hidden === true,
          telemetryHit: window.__coreTelemetry.some((entry) => entry.name === 'render-ledger-surface' && entry.args.activeTab === tabId)
        };
      };
      const specsTabLoad = await loadTab('specs');
      const dataTabLoad = await loadTab('data');
      document.querySelector('[data-tab="surface"]').click();
      await waitFrame();
      const surfaceRestoredAfterLedgerTabs = document.querySelector('[data-card-id="card-boot"]')?.hidden === false && document.querySelectorAll('.ledger-node').length === 0;
      const card = document.querySelector('[data-card-id="card-zone"]');
      const bootCard = document.querySelector('[data-card-id="card-boot"]');
      const group = document.querySelector('[data-group-id="group-core"]');
      const zone = document.querySelector('[data-zone-id="zone-frontend"]');
      const resizeHandle = zone.querySelector('.resize-handle.nw');
      const groupResizeHandle = group.querySelector('.resize-handle.se');
      const telemetryStart = window.__coreTelemetry.length;
      const telemetryPanelHidden = document.querySelector('.telemetry-panel').hidden;
      const threadInitiallyHidden = document.querySelector('.thread-panel').hidden;
      const beforeCardMove = rect(bootCard);
      bootCard.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 32, clientY: bootCard.getBoundingClientRect().top + 32, pointerId: 10 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 92, clientY: bootCard.getBoundingClientRect().top + 77, pointerId: 10 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: bootCard.getBoundingClientRect().left + 92, clientY: bootCard.getBoundingClientRect().top + 77, pointerId: 10 }));
      const afterCardMove = rect(bootCard);
      const persistedCard = JSON.parse(localStorage.getItem('corev2.canvas.state')).geometry.cards['card-boot'];
      bootCard.style.left = '33px';
      bootCard.style.top = '44px';
      document.querySelector('[data-action="refresh"]').click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const afterRefresh = rect(bootCard);
      const refreshRestoredCard = afterRefresh.left === persistedCard.x && afterRefresh.top === persistedCard.y;
      card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: card.getBoundingClientRect().left + 32, clientY: card.getBoundingClientRect().top + 32, pointerId: 19 }));
      card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: card.getBoundingClientRect().left + 32, clientY: card.getBoundingClientRect().top + 32, pointerId: 19 }));
      const bidirectionalConnectedCards = {
        bootConnected: bootCard.classList.contains('connected'),
        ledgerConnected: document.querySelector('[data-card-id="card-ledger"]').classList.contains('connected')
      };
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
      const beforeResize = rect(zone);
      resizeHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: zone.getBoundingClientRect().left, clientY: zone.getBoundingClientRect().top, pointerId: 12 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: zone.getBoundingClientRect().left + 400, clientY: zone.getBoundingClientRect().top + 400, pointerId: 12 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: zone.getBoundingClientRect().left + 400, clientY: zone.getBoundingClientRect().top + 400, pointerId: 12 }));
      const afterResize = rect(zone);
      document.querySelector('[data-tool="group"]').click();
      const grid = document.querySelector('.grid');
      const canvasScreenForGroupDraft = document.querySelector('.canvas').getBoundingClientRect();
      const expectedGroupDraftOrigin = { x: 760 - canvasScreenForGroupDraft.left, y: 190 - canvasScreenForGroupDraft.top };
      grid.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 760, clientY: 190, pointerId: 13 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 950, clientY: 360, pointerId: 13 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 950, clientY: 360, pointerId: 13 }));
      const createdGroup = document.querySelector('[data-group-id^="group-draft-"]');
      const createdGroupRect = createdGroup ? rect(createdGroup) : null;
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
      const beforeGroupMove = rect(group);
      group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().left + 24, clientY: group.getBoundingClientRect().top + 24, pointerId: 17 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: group.getBoundingClientRect().left + 64, clientY: group.getBoundingClientRect().top + 54, pointerId: 17 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().left + 64, clientY: group.getBoundingClientRect().top + 54, pointerId: 17 }));
      const afterGroupMove = rect(group);
      groupResizeHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: group.getBoundingClientRect().right, clientY: group.getBoundingClientRect().bottom, pointerId: 18 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: group.getBoundingClientRect().right + 60, clientY: group.getBoundingClientRect().bottom + 40, pointerId: 18 }));
      document.querySelector('.canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: group.getBoundingClientRect().right + 60, clientY: group.getBoundingClientRect().bottom + 40, pointerId: 18 }));
      const afterGroupResize = rect(group);
      document.querySelector('[data-tool="select"]').click();
      grid.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 980, clientY: 120, pointerId: 14 }));
      grid.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 980, clientY: 120, pointerId: 14 }));
      const backgroundClearedSelection = window.__coreState.selection.cardIds.length === 0 && window.__coreState.selection.zoneIds.length === 0 && window.__coreState.selection.groupIds.length === 0;
      const backgroundClearedFocus = document.activeElement === document.body;
      const path = document.querySelector('[data-relationship-id="rel-zone-ledger"]');
      const points = parsePath(path.getAttribute('d'));
      const sourceRect = rect(document.querySelector('[data-card-id="card-zone"]'));
      const targetRect = rect(document.querySelector('[data-card-id="card-ledger"]'));
      const sourceInteriorHit = points.slice(0, -1).some((point, index) => segmentHits(point, points[index + 1], sourceRect));
      const targetInteriorHit = points.slice(0, -1).some((point, index) => segmentHits(point, points[index + 1], targetRect));
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const distanceToRect = (point, box) => {
        const dx = Math.max(box.left - point.x, 0, point.x - box.right);
        const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
        return Math.hypot(dx, dy);
      };
      const sourceEndpointDistance = distanceToRect(points[0], sourceRect);
      const targetEndpointDistance = distanceToRect(points[points.length - 1], targetRect);
      const sourceBorderStandoff = sourceEndpointDistance >= 4 && sourceEndpointDistance <= 16 && !inside(points[0], sourceRect);
      const targetBorderStandoff = targetEndpointDistance >= 4 && targetEndpointDistance <= 16 && !inside(points[points.length - 1], targetRect);
      const relationshipEndpointChecks = [...document.querySelectorAll('[data-relationship-id]')].map((relationship) => {
        const relationshipPoints = parsePath(relationship.getAttribute('d'));
        const relationshipSourceRect = rect(document.querySelector(\`[data-card-id="\${relationship.dataset.source}"]\`));
        const relationshipTargetRect = rect(document.querySelector(\`[data-card-id="\${relationship.dataset.target}"]\`));
        const relationshipSourceDistance = distanceToRect(relationshipPoints[0], relationshipSourceRect);
        const relationshipTargetDistance = distanceToRect(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect);
        return {
          id: relationship.dataset.relationshipId,
          sourceDistance: relationshipSourceDistance,
          targetDistance: relationshipTargetDistance,
          sourceOutside: !inside(relationshipPoints[0], relationshipSourceRect),
          targetOutside: !inside(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect),
          ok: relationshipSourceDistance >= 4 && relationshipSourceDistance <= 16 && relationshipTargetDistance >= 4 && relationshipTargetDistance <= 16
        };
      });
      const canvasScreen = document.querySelector('.canvas').getBoundingClientRect();
      const clippedCards = [...document.querySelectorAll('[data-card-id]')]
        .map((element) => ({ id: element.dataset.cardId, rect: screenRect(element) }))
        .filter((item) => item.rect.left < canvasScreen.left || item.rect.right > canvasScreen.right || item.rect.top < canvasScreen.top || item.rect.bottom > canvasScreen.bottom);
      return {
        cardThreadText,
        specsTabLoad,
        dataTabLoad,
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
        clippedCards,
        telemetry: window.__coreTelemetry.slice(telemetryStart).map((entry) => ({ name: entry.name, args: entry.args }))
      };
    })()`
  });
  await send('Runtime.evaluate', { expression: 'location.reload();' });
  await wait(900);
  const restored = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const element = document.querySelector('[data-card-id="card-boot"]');
      return { restoredCard: { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight } };
    })()`
  });
  return { ...honeycomb.result.result.value, ...result.result.result.value, ...restored.result.result.value };
}
