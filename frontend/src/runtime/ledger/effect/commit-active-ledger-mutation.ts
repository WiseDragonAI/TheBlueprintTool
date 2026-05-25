import { state } from '../../state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';

export type ActiveLedgerMutation = {
  action: 'create-card' | 'patch-card' | 'create-zone' | 'create-group' | 'create-relationship' | 'delete-zones' | 'delete-relationships' | 'patch-geometry' | 'patch-region' | 'append-note' | 'delete-note' | 'paste-selection';
  card?: Record<string, unknown>;
  cardPatch?: {
    id: string;
    title?: string;
    description?: string;
  };
  annotation?: Record<string, unknown>;
  relationship?: Record<string, unknown>;
  zoneIds?: string[];
  relationshipIds?: string[];
  geometry?: {
    cards?: Record<string, { x: number; y: number; width: number; height: number }>;
    zones?: Record<string, { x: number; y: number; width: number; height: number }>;
    groups?: Record<string, { x: number; y: number; width: number; height: number }>;
  };
  region?: {
    id: string;
    kind: 'zone' | 'group';
    label?: string;
    color?: string;
  };
  note?: {
    threadId: string;
    body?: string;
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
  state.activeLedger = ledger;
  telemetry('load-ledger-state', { activeTab: state.activeTab, source: 'server-ledger-mutation', action: mutation.action });
  if (options.render) renderCanvasSurface();
  return true;
}
