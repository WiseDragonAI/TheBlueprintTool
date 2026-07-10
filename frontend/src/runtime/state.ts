/**
 * WHAT: Defines and initializes mutable client runtime state.
 * WHY: Controllers and effects need one canonical store for the active workspace session.
 */
export type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export type PointerSelectionSnapshot = SelectionState & {
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
};

export type LedgerReconciliationState = {
  routeEpoch: number;
  routeLedgerStateId: string;
  nextRequestSequence: number;
  lastAppliedServerRevision: number;
  lastAppliedSequence: number;
  localGeometryRevisions: Record<string, number>;
  failedLoadCount: number;
  lastFailedLoad: null | {
    at: string;
    ledgerStateId: string;
    routeEpoch: number;
    sequence: number;
    source: string;
    reason: string;
  };
};

export type ThreadContentRefreshScope = {
  ledgerId: string;
  threadId: string;
  contentFile: string;
};

export type LedgerContentRefreshState = {
  inFlight: boolean;
  ledgerReasons: string[];
  changedContentFiles: string[];
  changedCardIds?: string[];
  threadReasons: string[];
  threadScope: ThreadContentRefreshScope | null;
};

export type ThreadPanelTab = 'thread' | 'codex-log';

export type ThreadRunDisclosureState = Record<string, boolean>;

export const state: any = {
  routePath: globalThis.window?.location?.pathname ?? '/',
  projectName: 'Project',
  canvasMode: 'ledger',
  activeLedgerId: 'specs',
  activeTab: 'specs',
  ledgers: [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
  ],
  ledgerTabs: [
    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
  ],
  activeLedger: null,
  ledgerReconciliation: {
    routeEpoch: 0,
    routeLedgerStateId: 'specs',
    nextRequestSequence: 1,
    lastAppliedServerRevision: -1,
    lastAppliedSequence: 0,
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  } satisfies LedgerReconciliationState,
  activeTool: 'select',
  railCollapsed: false,
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
  renderedThreadId: '',
  threadScrollTopByThreadId: {},
  threadLogScrollTopByThreadId: {},
  threadActiveTabByThreadId: {} as Record<string, ThreadPanelTab>,
  threadRunIdByThreadId: {} as Record<string, string>,
  threadRunSummaryByThreadId: {},
  threadRunEventsByThreadId: {},
  threadCoalescedToolsByThreadId: {},
  threadToolGroupDisclosureByThreadId: {} as Record<string, ThreadRunDisclosureState>,
  threadToolRowDisclosureByThreadId: {} as Record<string, ThreadRunDisclosureState>,
  threadRunAnnouncementByThreadId: {},
  threadRunAnnouncedSequenceByThreadId: {},
  threadPanelOpen: false,
  ledgerContentRefresh: {
    inFlight: false,
    ledgerReasons: [],
    changedContentFiles: [],
    changedCardIds: [],
    threadReasons: [],
    threadScope: null
  } satisfies LedgerContentRefreshState,
  pendingLedgerContentRefresh: false,
  pendingThreadContentRefresh: false,
  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
  telemetry: []
};
