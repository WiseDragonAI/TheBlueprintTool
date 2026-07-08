/**
 * WHAT: Commits a ledger mutation and replaces active state with the reconciled server ledger.
 * WHY: Canvas edits are server-authoritative, but optimistic thread notes must be merged through ledger ownership.
 */
import { state } from '../../state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
import { refreshZoneAttributionCache } from '../helper/zone-attribution-cache.js';

export type ActiveLedgerMutation = {
  action: 'create-card' | 'patch-card' | 'delete-card' | 'delete-card-image' | 'create-zone' | 'create-group' | 'create-relationship' | 'delete-zones' | 'delete-relationships' | 'patch-geometry' | 'patch-viewport' | 'patch-region' | 'append-note' | 'update-note' | 'delete-note' | 'paste-selection';
  card?: Record<string, unknown>;
  cardId?: string;
  imageSrc?: string;
  cardPatch?: {
    id: string;
    status?: 'todo' | 'done';
    title?: string;
    description?: string;
    imageSizes?: Record<string, { width?: number; height?: number }>;
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
};

export async function commitActiveLedgerMutation(mutation: ActiveLedgerMutation, options: { render?: boolean } = {}): Promise<boolean> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) return false;
  const ledgerStateId = state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab;
  const canMergeLocalCanvas = mutation.action !== 'patch-geometry' && Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const localLedger = canMergeLocalCanvas ? state.activeLedger : null;
  telemetry('commit-ledger-edit', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }).catch(() => undefined);
  if (!response?.ok) {
    telemetry('commit-ledger-edit-failed', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
    return false;
  }
  const ledger = await response.json().catch(() => null);
  if (!ledger || typeof ledger !== 'object') return false;
  state.activeLedger = mergeLocalThreadNotes(canMergeLocalCanvas ? mergeLocalCanvasStateIntoLedger(ledger, localLedger) : ledger);
  state.activeLedgerId = ledgerStateId;
  refreshZoneAttributionCache(`server-ledger-mutation:${mutation.action}`);
  telemetry('load-ledger-state', { activeTab: state.activeTab, source: 'server-ledger-mutation', action: mutation.action });
  if (options.render) renderCanvasSurface({ renderThreadPanel: mutation.action !== 'patch-geometry' });
  return true;
}
