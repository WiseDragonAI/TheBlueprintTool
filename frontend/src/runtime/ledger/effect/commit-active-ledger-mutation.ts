/**
 * WHAT: Commits a ledger mutation and submits its response to active-ledger reconciliation.
 * WHY: A successful server response must not replace newer route or local geometry state.
 */
import { state } from '../../state.js';
import { renderCanvasSurface } from '../../surface/effect/canvas-surface-effects.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { geometryRevisionSnapshot } from '../helper/active-ledger-geometry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import {
  beginActiveLedgerRequest,
  ledgerRevisionFromResponse,
  reconcileActiveLedgerState,
  recordActiveLedgerLoadFailure
} from './reconcile-active-ledger-state.js';
import type { CodexEffort, CodexModel } from '../../codex/helper/codex-run-options.js';
import type { CardQuestionnaires } from '../../../../../shared/schemas/questionnaire-types.js';
import type { GitReviewNote } from '../../../../../shared/schemas/git-review-types.js';

export type ActiveLedgerMutation = {
  action: 'create-card' | 'create-task-intake' | 'reassign-task' | 'transition-card-lifecycle' | 'patch-card' | 'delete-card' | 'delete-card-image' | 'create-zone' | 'create-group' | 'create-relationship' | 'delete-zones' | 'delete-relationships' | 'patch-geometry' | 'patch-viewport' | 'patch-region' | 'append-note' | 'update-note' | 'delete-note' | 'paste-selection';
  card?: Record<string, unknown>;
  cardId?: string;
  assignedNodeId?: string;
  lifecycleStatus?: 'todo' | 'backlog' | 'done';
  imageSrc?: string;
  cardPatch?: {
    id: string;
    title?: string;
    description?: string;
    imageSizes?: Record<string, { width?: number; height?: number }>;
    questionnaires?: CardQuestionnaires;
    gitReviewNotes?: GitReviewNote[];
    codexRunModel?: CodexModel;
    codexRunEffort?: CodexEffort;
  };
  annotation?: Record<string, unknown>;
  relationship?: Record<string, unknown>;
  zoneIds?: string[];
  groupIds?: string[];
  relationshipIds?: string[];
  geometry?: {
    cards?: Record<string, { x: number; y: number; width: number; height: number }>;
    zones?: Record<string, { x: number; y: number; width: number; height: number }>;
    groups?: Record<string, { x: number; y: number; width: number; height: number }>;
  };
  viewport?: { x: number; y: number; scale: number };
  region?: {
    id: string;
    kind: 'zone' | 'group';
    label?: string;
    color?: string;
  };
  note?: {
    id?: string;
    threadId: string;
    body?: string;
    voiceFileRef?: string;
    status?: string;
    transcriptionStartedAt?: string;
    source?: string;
    error?: string;
    imageSizes?: Record<string, { width?: number; height?: number }>;
  };
  selection?: {
    cardIds: string[];
    zoneIds: string[];
    groupIds: string[];
  };
  pasteSuffix?: string;
};

export type CommitActiveLedgerMutationOptions = {
  render?: boolean;
  submittedGeometryRevisions?: Record<string, number>;
};

export async function commitActiveLedgerMutation(mutation: ActiveLedgerMutation, options: CommitActiveLedgerMutationOptions = {}): Promise<boolean> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  const ledgerStateId = state.canvasMode === 'projects' ? 'projects-canvas' : state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab;
  const request = beginActiveLedgerRequest(ledgerStateId);
  if (!endpoint) {
    recordActiveLedgerLoadFailure({ request, source: `server-ledger-mutation:${mutation.action}`, reason: 'missing-ledger-tab' });
    return false;
  }
  const submittedGeometryRevisions = mutation.action === 'patch-geometry'
    ? options.submittedGeometryRevisions ?? geometryRevisionSnapshot(mutation.geometry)
    : undefined;
  telemetry('commit-ledger-edit', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }).catch(() => undefined);
  if (!response?.ok) {
    recordActiveLedgerLoadFailure({ request, source: `server-ledger-mutation:${mutation.action}`, reason: `http-${response?.status ?? 0}` });
    telemetry('commit-ledger-edit-failed', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
    return false;
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  let ledger: unknown = payload;
  if (payload?.ok === true && typeof payload.ledgerId === 'string') {
    if ((mutation.action === 'patch-geometry' || mutation.action === 'patch-viewport') && state.activeLedger) {
      ledger = state.activeLedger;
    } else {
      const snapshot = await fetch(`/api/ledgers/${encodeURIComponent(payload.ledgerId)}/canvas`, { cache: 'no-store' }).catch(() => undefined);
      ledger = snapshot?.ok ? await snapshot.json().catch(() => null) : null;
    }
  }
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    recordActiveLedgerLoadFailure({ request, source: `server-ledger-mutation:${mutation.action}`, reason: 'invalid-ledger' });
    return false;
  }
  const applied = reconcileActiveLedgerState({
    ledger,
    request,
    serverRevision: ledgerRevisionFromResponse(response),
    source: `server-ledger-mutation:${mutation.action}`,
    submittedGeometryRevisions
  });
  if (applied) {
    telemetry('load-ledger-state', { activeTab: state.activeTab, source: 'server-ledger-mutation', action: mutation.action });
    if (options.render) renderCanvasSurface({ renderThreadPanel: mutation.action !== 'patch-geometry' });
  }
  return applied;
}
