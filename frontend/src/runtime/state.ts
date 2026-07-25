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
  lastAppliedTaskClock?: Record<string, number>;
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
  projectId: string;
  replicaNodeId: string;
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
  lastInvalidationRevision?: number;
  invalidationLedgerStateId?: string;
};

export type ThreadPanelTab = 'thread' | 'codex-log';

export type ThreadViewportEntryReason = 'panel-open' | 'thread-switch' | 'tab-activation';

export type ThreadViewportPinRequest = {
  threadId: string;
  surface: ThreadPanelTab;
  openGeneration: number;
  reason: ThreadViewportEntryReason;
};

export type ThreadRunDisclosureState = Record<string, boolean>;

export const state: any = {
  routePath: globalThis.window?.location?.pathname ?? '/',
  projectId: '',
  replicaNodeId: '',
  projectName: 'Project',
  projectColor: '#38d9e8',
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
    lastAppliedTaskClock: {},
    localGeometryRevisions: {},
    failedLoadCount: 0,
    lastFailedLoad: null
  } satisfies LedgerReconciliationState,
  activeTool: 'select',
  railCollapsed: false,
  zoneColor: '#38d9e8',
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
  threadFollowBottomByThreadId: {} as Record<string, boolean>,
  threadLogScrollTopByThreadId: {},
  threadLogFollowBottomByThreadId: {} as Record<string, boolean>,
  threadActiveTabByThreadId: {} as Record<string, ThreadPanelTab>,
  threadViewportOpenGeneration: 0,
  threadViewportPinRequest: null as ThreadViewportPinRequest | null,
  threadSelectedRunIdByThreadId: {} as Record<string, string>,
  threadSelectedExecutionIdByThreadId: {} as Record<string, string>,
  // WHAT: Cache one task hierarchy and one exact lightweight presentation per open thread.
  // WHY: Codex Log rendering must not reconstruct execution ownership from card session aliases.
  threadTaskExecutionStateByThreadId: {},
  threadExecutionPresentationByThreadId: {},
  threadExecutionStateErrorByThreadId: {},
  threadExecutionPresentationErrorByThreadId: {},
  threadRunIdByThreadId: {} as Record<string, string>,
  threadRunExecutionsByRunId: {},
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
