/**
 * WHAT: Verifies Codex session matching, complete-tail parsing, context math, limits, and elapsed time.
 * WHY: Execution status crosses durable lifecycle and provider-owned JSONL without mutation.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { codexExecutionStatus } from '../../src/business/codex/helper/codex-execution-status.js';

function execution(providerSessionId: string | null, finishedAt: string | null = null) {
  return { metadata: { executionId: 'execution-a', requestedAt: '2026-08-03T00:00:00.000Z' }, lifecycle: { phase: finishedAt ? 'succeeded' : 'running', startedAt: '2026-08-03T00:00:01.000Z', finishedAt, providerSessionId } } as Parameters<typeof codexExecutionStatus>[0]['execution'];
}

test('resolves matching latest complete context and every available limit window', () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-codex-status-'));
  try {
    const sessions = join(codexHome, 'sessions', '2026', '08', '03');
    mkdirSync(sessions, { recursive: true });
    writeFileSync(join(sessions, 'rollout-provider-a.jsonl'), [
      JSON.stringify({ type: 'session_meta', payload: { id: 'provider-a' } }),
      JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { total_tokens: 12000 }, model_context_window: 112000 }, rate_limits: { primary: { used_percent: 9, window_minutes: 10080, resets_at: 1786181296 }, secondary: { used_percent: 25, window_minutes: 300, resets_at: 1786180000 } } } }),
      JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { total_tokens: 62000 }, model_context_window: 112000 }, rate_limits: { primary: { used_percent: 10, window_minutes: 10080, resets_at: 1786181296 }, secondary: null } } }),
      '{"type":"event_msg"',
    ].join('\n'));
    writeFileSync(join(sessions, 'rollout-provider-mismatch.jsonl'), `${JSON.stringify({ type: 'session_meta', payload: { id: 'another-provider' } })}\n`);
    const status = codexExecutionStatus({ execution: execution('provider-a'), codexHome, now: new Date('2026-08-03T00:01:41.000Z') });
    assert.equal(status.elapsed.milliseconds, 100_000);
    assert.deepEqual(status.context, { available: true, usedTokens: 62000, windowTokens: 112000, remainingTokens: 50000, remainingPercent: 50 });
    assert.deepEqual(status.limits, [{ name: 'primary', usedPercent: 10, remainingPercent: 90, windowMinutes: 10080, resetsAt: new Date(1786181296 * 1000).toISOString() }]);
  } finally {
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('keeps terminal elapsed available when provider metrics are unavailable', () => {
  const status = codexExecutionStatus({ execution: execution(null, '2026-08-03T00:00:11.000Z'), codexHome: '/missing', now: new Date('2026-08-04T00:00:00.000Z') });
  assert.equal(status.elapsed.milliseconds, 10_000);
  assert.equal(status.providerSession.available, false);
  assert.equal(status.context.available, false);
  assert.deepEqual(status.limits, []);
});
