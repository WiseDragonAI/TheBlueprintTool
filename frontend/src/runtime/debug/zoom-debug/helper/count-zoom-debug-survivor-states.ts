/**
 * WHAT: Counts persistent low-detail survivor surfaces and their detail-history markers.
 * WHY: Root-cause analysis needs to compare fresh low-detail against history-dirty low-detail at the same final zoom.
 */
export function countZoomDebugSurvivorStates(): {
  overviewLayers: number;
  overviewSawDetail: number;
  zoneTitles: number;
  zoneTitlesSawDetail: number;
  relationshipTexts: number;
  relationshipTextsSawDetail: number;
  cardShells: number;
  cardShellsSawDetail: number;
  zoneLabelProxies: number;
  connectedCards: number;
  textShadowTargets: number;
  boxShadowTargets: number;
  willChangeOpacity: number;
  detailRevealAttrs: number;
  detailRevealStaged: number;
} {
  const overviewLayers = document.querySelectorAll<HTMLElement>('.ledger-card-overview-layer').length;
  const overviewSawDetail = document.querySelectorAll<HTMLElement>('.ledger-card-overview-layer[data-debug-saw-detail="1"]').length;
  const zoneTitles = document.querySelectorAll<HTMLElement>('.zone-title').length;
  const zoneTitlesSawDetail = document.querySelectorAll<HTMLElement>('.zone-title[data-debug-saw-detail="1"]').length;
  const relationshipTexts = document.querySelectorAll<SVGTextElement>('.relationships text').length;
  const relationshipTextsSawDetail = document.querySelectorAll<SVGTextElement>('.relationships text[data-debug-saw-detail="1"]').length;
  const cardShells = document.querySelectorAll<HTMLElement>('.card[data-card-id]').length;
  const cardShellsSawDetail = document.querySelectorAll<HTMLElement>('.card[data-card-id][data-debug-saw-detail="1"]').length;
  const zoneLabelProxies = document.querySelectorAll<HTMLElement>('.zone-label-proxy').length;
  const connectedCards = document.querySelectorAll<HTMLElement>('.card.connected').length;
  const textShadowTargets = document.querySelectorAll<HTMLElement>('.ledger-card-title, .zone-title, .zone-label-proxy').length;
  const boxShadowTargets = document.querySelectorAll<HTMLElement>('.card-status-indicator, .ledger-card-label, .regular-zone, .card.connected').length;
  const willChangeOpacity = document.querySelectorAll<HTMLElement>('.ledger-card-detail-layer, .ledger-card-overview-layer').length;
  const detailRevealAttrs = document.querySelectorAll<HTMLElement>('.card[data-card-id][data-detail-reveal]').length;
  const detailRevealStaged = document.querySelectorAll<HTMLElement>('.canvas.detail-reveal-staged').length;
  return {
    overviewLayers,
    overviewSawDetail,
    zoneTitles,
    zoneTitlesSawDetail,
    relationshipTexts,
    relationshipTextsSawDetail,
    cardShells,
    cardShellsSawDetail,
    zoneLabelProxies,
    connectedCards,
    textShadowTargets,
    boxShadowTargets,
    willChangeOpacity,
    detailRevealAttrs,
    detailRevealStaged
  };
}
