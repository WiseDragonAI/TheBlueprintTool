/**
 * WHAT: Locks the shared card execution lease and admission serialization contracts.
 * WHY: Every launch path must agree on exact ownership before it can mutate queue or runtime state.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCardCodexAdmissionCount, withCardCodexAdmission } from '@backend/business/codex/helper/card-codex-admission-lock.js';
import { cardCodexExecutionOwnership } from '@backend/business/codex/helper/card-codex-execution-ownership.js';
import { projectCardCodexRun } from '@backend/business/codex/helper/project-card-codex-run.js';

test('card execution ownership rejects every half-owned persisted lease', () => {
  assert.deepEqual(cardCodexExecutionOwnership({}), { state: 'none' });
  assert.deepEqual(cardCodexExecutionOwnership({ codexActiveRunId: 'run-a' }), {
    state: 'contradictory', runId: 'run-a', executionId: '',
  });
  assert.deepEqual(cardCodexExecutionOwnership({ codexActiveExecutionId: 'execution-a' }), {
    state: 'contradictory', runId: '', executionId: 'execution-a',
  });
  assert.deepEqual(cardCodexExecutionOwnership({ codexActiveRunId: 'run-a', codexActiveExecutionId: 'execution-a' }), {
    state: 'active', lease: { runId: 'run-a', executionId: 'execution-a' },
  });
});

test('card admission serializes different launch kinds and releases its key after failure', async () => {
  const scope = { decisionOsRoot: '/tmp/decision-os-admission-test', ledgerId: 'specs', cardId: 'card-a' };
  const transitions: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = withCardCodexAdmission(scope, async () => {
    transitions.push('thread-enter');
    await firstGate;
    transitions.push('thread-exit');
    return 'thread';
  });
  const second = withCardCodexAdmission(scope, async () => {
    transitions.push('pipeline-enter');
    throw new Error('injected admission failure');
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(transitions, ['thread-enter']);
  assert.equal(activeCardCodexAdmissionCount(), 1);
  releaseFirst();
  assert.equal(await first, 'thread');
  await assert.rejects(second, /injected admission failure/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(transitions, ['thread-enter', 'thread-exit', 'pipeline-enter']);
  assert.equal(activeCardCodexAdmissionCount(), 0);
});

test('direct and pipeline projections preserve the durable thread session', () => {
  const ledger: { cards: Array<Record<string, unknown>> } = { cards: [{
    id: 'card-a',
    codexThreadRunId: 'thread-session',
    codexThreadRunIds: ['thread-session'],
    codexThreadRunOutputFile: '.decision-os/runs/codex-skills/specs/thread-session.md',
    codexThreadRunOutputFiles: { 'thread-session': '.decision-os/runs/codex-skills/specs/thread-session.md' },
  }] };
  projectCardCodexRun({
    ledger,
    cardId: 'card-a',
    runId: 'pipeline-skill',
    executionId: 'pipeline-execution',
    outputFileRef: '.decision-os/runs/codex-skills/specs/pipeline-skill.md',
    codexModel: 'gpt-5.6-sol',
    codexEffort: 'medium',
    ownership: 'card',
  });
  const [card] = ledger.cards;
  assert.equal(card.codexThreadRunId, 'thread-session');
  assert.deepEqual(card.codexThreadRunIds, ['thread-session']);
  assert.equal(card.codexThreadRunOutputFile, '.decision-os/runs/codex-skills/specs/thread-session.md');
  assert.deepEqual(card.codexThreadRunOutputFiles, { 'thread-session': '.decision-os/runs/codex-skills/specs/thread-session.md' });
  assert.equal(card.codexRunId, 'pipeline-skill');
});
