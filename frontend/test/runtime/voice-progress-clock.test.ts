import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stopVoiceProgressClock,
  syncVoiceProgressClock,
  tickVoiceProgressClock,
  voiceProgressClockActiveForTests
} from '../../src/runtime/voice/effect/run-voice-progress-clock.js';

test('voice elapsed display advances every second without a server response', () => {
  const previousDocument = globalThis.document;
  const firstNode = {
    dataset: {
      voicePhaseStartedAt: '2026-07-13T08:28:16.000Z',
      voicePhaseLabel: 'Transcribing'
    },
    textContent: ''
  };
  let nodes = [firstNode];
  (globalThis as unknown as { document: unknown }).document = { querySelectorAll: () => nodes };
  try {
    assert.equal(tickVoiceProgressClock(Date.parse('2026-07-13T08:28:16.100Z')), 1);
    assert.equal(firstNode.textContent, 'Transcribing · 0s');
    const replacementNode = { ...firstNode, textContent: '' };
    nodes = [replacementNode];
    tickVoiceProgressClock(Date.parse('2026-07-13T08:28:17.100Z'));
    assert.equal(firstNode.textContent, 'Transcribing · 0s');
    assert.equal(replacementNode.textContent, 'Transcribing · 1s');
    tickVoiceProgressClock(Date.parse('2026-07-13T08:28:18.100Z'));
    assert.equal(replacementNode.textContent, 'Transcribing · 2s');
  } finally {
    stopVoiceProgressClock();
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('one shared voice clock stops when no elapsed nodes remain', () => {
  const previousDocument = globalThis.document;
  const previousSetInterval = globalThis.setInterval;
  const previousClearInterval = globalThis.clearInterval;
  let scheduled = 0;
  let cleared = 0;
  let nodes: unknown[] = [{ dataset: { voicePhaseStartedAt: new Date().toISOString(), voicePhaseLabel: 'Transcribing' }, textContent: '' }];
  (globalThis as unknown as { document: unknown }).document = { querySelectorAll: () => nodes };
  (globalThis as unknown as { setInterval: unknown }).setInterval = (() => {
    scheduled += 1;
    return 1;
  }) as unknown;
  (globalThis as unknown as { clearInterval: unknown }).clearInterval = (() => { cleared += 1; }) as unknown;
  try {
    syncVoiceProgressClock();
    assert.equal(voiceProgressClockActiveForTests(), true);
    syncVoiceProgressClock();
    assert.equal(voiceProgressClockActiveForTests(), true);
    assert.equal(scheduled, 1);
    nodes = [];
    syncVoiceProgressClock();
    assert.equal(voiceProgressClockActiveForTests(), false);
    assert.equal(cleared, 1);
  } finally {
    stopVoiceProgressClock();
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    globalThis.setInterval = previousSetInterval;
    globalThis.clearInterval = previousClearInterval;
  }
});
