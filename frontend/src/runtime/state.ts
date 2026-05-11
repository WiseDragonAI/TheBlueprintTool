export const state: any = {
  routePath: window.location.pathname,
  activeTab: 'surface',
  activeTool: 'select',
  zoneColor: '#55b8ff',
  zoneCounter: 3,
  groupCounter: 2,
  viewport: { x: 0, y: 0, scale: 1 },
  selection: { cardIds: [], zoneIds: [], groupIds: [] },
  pointer: null,
  clipboard: null,
  threadId: '',
  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
  telemetry: []
};
