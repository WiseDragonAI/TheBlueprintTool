/**
 * WHAT: Provides a deterministic ledger and server state for implementation and tests.
 * WHY: Unit, integration, browser-runtime, and backend-route tests need stable graph truth.
 */

import type { CanvasLedger, ServerState } from '../schemas/core-types.js';

const updatedAt = '2026-05-10T00:00:00.000Z';

export function createSampleLedger(): CanvasLedger {
  return {
    ledgerId: 'ledger-core',
    name: 'Core QA',
    slug: 'core-qa',
    canvasId: 'canvas-core',
    updatedAt,
    viewport: { id: 'viewport-core', x: 120, y: -60, scale: 0.85 },
    cards: [
      {
        id: 'card-a',
        title: 'Ledger',
        description: '**Durable** JSON truth for cards, zones, groups, relationships, and threads.',
        rect: { x: 180, y: 140, width: 320, height: 190 },
        labels: ['data', 'json'],
        threadId: 'thread-card-a',
        tabs: ['notes', 'fields', 'history']
      },
      {
        id: 'card-b',
        title: 'Canvas Runtime',
        description: 'DOM canvas rendering with route-addressable tabs and SVG relationships.',
        rect: { x: 620, y: 180, width: 320, height: 210 },
        labels: ['runtime'],
        threadId: 'thread-card-b',
        tabs: ['notes', 'fields']
      },
      {
        id: 'card-c',
        title: 'Voice Thread',
        description: 'Thread-scoped voice notes are transient until transcription completes.',
        rect: { x: 520, y: 520, width: 320, height: 190 },
        labels: ['voice'],
        threadId: 'thread-card-c',
        tabs: ['notes']
      }
    ],
    zones: [
      {
        id: 'zone-main',
        name: 'Implementation Zone',
        color: '#3b82f6',
        rect: { x: 120, y: 90, width: 900, height: 420 },
        threadId: 'thread-zone-main'
      },
      {
        id: 'zone-voice',
        name: 'Voice Notes',
        color: '#22c55e',
        rect: { x: 460, y: 470, width: 460, height: 280 },
        threadId: 'thread-zone-voice'
      }
    ],
    groups: [
      {
        id: 'group-runtime',
        title: 'Runtime Cluster',
        rect: { x: 80, y: 60, width: 980, height: 720 }
      }
    ],
    relationships: [
      {
        id: 'rel-a-b',
        sourceCardId: 'card-a',
        targetCardId: 'card-b',
        label: 'feeds',
        showLabel: true
      },
      {
        id: 'rel-b-c',
        sourceCardId: 'card-b',
        targetCardId: 'card-c',
        label: 'opens thread',
        showLabel: true
      }
    ],
    threads: [
      {
        id: 'thread-card-a',
        targetKind: 'card',
        targetId: 'card-a',
        messages: [
          { id: 'msg-a-1', author: 'operator', body: 'Keep ledger truth committed.', createdAt: updatedAt },
          { id: 'msg-a-2', author: 'assistant', body: 'Ledger writes are JSON patches.', createdAt: updatedAt }
        ]
      },
      {
        id: 'thread-card-b',
        targetKind: 'card',
        targetId: 'card-b',
        messages: [{ id: 'msg-b-1', author: 'operator', body: 'Render with DOM and SVG.', createdAt: updatedAt }]
      },
      {
        id: 'thread-card-c',
        targetKind: 'card',
        targetId: 'card-c',
        messages: [{ id: 'msg-c-1', author: 'operator', body: 'Transcription should fill the draft.', createdAt: updatedAt }]
      },
      {
        id: 'thread-zone-main',
        targetKind: 'zone',
        targetId: 'zone-main',
        messages: [{ id: 'msg-z-1', author: 'system', body: 'Zone thread exists.', createdAt: updatedAt }]
      },
      {
        id: 'thread-zone-voice',
        targetKind: 'zone',
        targetId: 'zone-voice',
        messages: [{ id: 'msg-z-2', author: 'system', body: 'Voice zone thread exists.', createdAt: updatedAt }]
      }
    ]
  };
}

export function createSampleServerState(): ServerState {
  const ledger = createSampleLedger();
  const secondary = { ...ledger, ledgerId: 'ledger-runbook', name: 'Runbook', slug: 'runbook', canvasId: 'canvas-runbook' };
  return {
    tabs: [
      { id: 'tab-core', label: ledger.name, slug: ledger.slug, ledgerId: ledger.ledgerId, canvasId: ledger.canvasId, isDefault: true },
      { id: 'tab-runbook', label: secondary.name, slug: secondary.slug, ledgerId: secondary.ledgerId, canvasId: secondary.canvasId, isDefault: false }
    ],
    defaultTabId: 'tab-core',
    ledgers: [ledger, secondary],
    events: []
  };
}
