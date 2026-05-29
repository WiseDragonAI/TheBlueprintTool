export const state: any = {
  routePath: globalThis.window?.location?.pathname ?? '/',
  activeTab: 'specs',
  ledgerTabs: [
    { id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.blueprinttool/data.json' }
  ],
  activeLedger: null,
  activeTool: 'select',
  zoneColor: '#55b8ff',
  cardCounter: 1,
  zoneCounter: 3,
  groupCounter: 2,
  viewport: { x: 0, y: 0, scale: 1 },
  surfaceViewport: { x: 0, y: 0, scale: 1 },
  viewports: { specs: { x: 0, y: 0, scale: 1 }, data: { x: 0, y: 0, scale: 1 } },
  cardUi: { openCardIds: [], activeTabByCardId: {} },
  zoneAttributionCache: null,
  selection: { cardIds: [], zoneIds: [], groupIds: [] },
  pointer: null,
  clipboard: null,
  threadId: '',
  threadPanelOpen: false,
  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
  telemetry: []
};
