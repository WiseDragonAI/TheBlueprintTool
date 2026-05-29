export const browserReadOverviewDetail = `
async function browserReadOverviewDetail() {
  document.querySelector('[data-tab="surface"]').click();
  await browserWaitFrame();
  const canvas = document.querySelector('.canvas');
  for (let index = 0; index < 16; index += 1) {
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 700, clientY: 360, deltaY: 120 }));
  }
  await browserWaitFrame();
  const lowDetailZoneTitle = document.querySelector('.zone-title');
  const lowDetailCardTitle = document.querySelector('.card strong');
  const lowDetailZoneTitleStyle = lowDetailZoneTitle ? getComputedStyle(lowDetailZoneTitle) : null;
  const lowDetailCardTitleStyle = lowDetailCardTitle ? getComputedStyle(lowDetailCardTitle) : null;
  const lowDetailState = {
    viewportScale: window.__coreState.viewport.scale,
    lowDetail: canvas.classList.contains('low-detail'),
    zoneTitleHidden: lowDetailZoneTitleStyle?.display === 'none',
    cardTitleVisible: lowDetailCardTitleStyle?.display !== 'none',
    cardTitleCounterScaled: lowDetailCardTitleStyle?.transform !== 'none'
  };
  for (let index = 0; index < 20; index += 1) {
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 700, clientY: 360, deltaY: 120 }));
  }
  await browserWaitFrame();
  const zoneTitle = document.querySelector('.zone-title');
  const cardTitle = document.querySelector('.card strong');
  const gridRect = document.querySelector('.grid').getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const zoneTitleStyle = zoneTitle ? getComputedStyle(zoneTitle) : null;
  const cardTitleStyle = cardTitle ? getComputedStyle(cardTitle) : null;
  return {
    viewportScale: window.__coreState.viewport.scale,
    lowDetail: canvas.classList.contains('low-detail'),
    overviewDetail: canvas.classList.contains('overview-detail'),
    worldCoversCanvas: gridRect.left <= canvasRect.left && gridRect.right >= canvasRect.right && gridRect.top <= canvasRect.top && gridRect.bottom >= canvasRect.bottom,
    zoneTitleHidden: zoneTitleStyle?.display === 'none',
    cardTitleVisible: cardTitleStyle?.display !== 'none',
    cardTitleCounterScaled: cardTitleStyle?.transform !== 'none',
    lowDetailState,
    zoneTitleMaxWidth: zoneTitleStyle?.maxWidth ?? '',
    cardBodyHidden: getComputedStyle(document.querySelector('.card p')).display === 'none',
    cardControlsHidden: getComputedStyle(document.querySelector('.card-actions')).display === 'none'
  };
}
`;
