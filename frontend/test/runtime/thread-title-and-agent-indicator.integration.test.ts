/**
 * WHAT: Runtime tests for target-title thread headers and card agent indicators.
 * WHY: Conversation context must be visible both in the side panel and on cards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardHasAgentLastAnswer } from '../../src/runtime/card/helper/card-has-agent-last-answer.js';
import { resolveCardWorkStatus } from '../../src/runtime/card/helper/resolve-card-work-status.js';
import { resolveThreadTargetTitle } from '../../src/runtime/thread/helper/resolve-thread-target-title.js';
import { state } from '../../src/runtime/state.js';

test('resolve-thread-target-title prefers the visible card title over the thread id', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    querySelector() {
      return {
        querySelector() {
          return { textContent: 'Mason Stone Sale' };
        }
      };
    }
  };
  try {
    assert.equal(resolveThreadTargetTitle('thread-prep_mason_stone_sale_81c2f2c6'), 'Mason Stone Sale');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('resolve-thread-target-title falls back to ledger card titles', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = { querySelector: () => null };
  state.activeLedger = { cards: [{ id: 'card-a', title: 'Ledger Card A' }], annotations: [] };
  try {
    assert.equal(resolveThreadTargetTitle('thread-card-a'), 'Ledger Card A');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    state.activeLedger = null;
  }
});

test('card-has-agent-last-answer only marks assistant or agent latest notes', () => {
  state.activeLedger = {
    notes: {
      'thread-card-a': [{ role: 'operator', message: 'Question' }, { role: 'assistant', message: 'Answer' }],
      'thread-card-b': [{ role: 'assistant', message: 'Answer' }, { role: 'operator', message: 'Follow-up' }]
    }
  };
  try {
    assert.equal(cardHasAgentLastAnswer('card-a'), true);
    assert.equal(cardHasAgentLastAnswer('card-b'), false);
  } finally {
    state.activeLedger = null;
  }
});

test('resolve-card-work-status derives processing from latest operator notes and lets done win', () => {
  state.activeLedger = {
    notes: {
      'thread-card-a': [{ role: 'operator', message: 'Question' }, { role: 'assistant', message: 'Answer' }],
      'thread-card-b': [{ role: 'assistant', message: 'Answer' }, { role: 'operator', message: 'Follow-up' }],
      'thread-card-c': [{ role: 'operator', message: 'Follow-up' }],
      'thread-card-d': [{ role: 'voice', message: 'Transcribed operator note' }]
    }
  };
  try {
    assert.equal(resolveCardWorkStatus({ id: 'card-a' }), 'todo');
    assert.equal(resolveCardWorkStatus({ id: 'card-b' }), 'processing');
    assert.equal(resolveCardWorkStatus({ id: 'card-c', status: 'done' }), 'done');
    assert.equal(resolveCardWorkStatus({ id: 'card-d' }), 'processing');
    assert.equal(resolveCardWorkStatus({ id: 'card-new' }), 'todo');
  } finally {
    state.activeLedger = null;
  }
});
