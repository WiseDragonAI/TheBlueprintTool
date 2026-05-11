export const state: any = {
  routePath: window.location.pathname,
  activeTab: 'surface',
  ledgerTabs: [
    { id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.blueprinttool/data.json' }
  ],
  activeLedger: null,
  activeTool: 'select',
  zoneColor: '#55b8ff',
  zoneCounter: 3,
  groupCounter: 2,
  viewport: { x: 0, y: 0, scale: 1 },
  surfaceViewport: { x: 0, y: 0, scale: 1 },
  selection: { cardIds: [], zoneIds: [], groupIds: [] },
  pointer: null,
  clipboard: null,
  threadId: '',
  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
  telemetry: []
};
