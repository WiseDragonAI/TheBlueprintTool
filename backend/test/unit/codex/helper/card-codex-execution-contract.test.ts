/**
 * WHAT: Locks card admission serialization and durable provider-session projection.
 * WHY: Launches must serialize locally while lifecycle ownership remains in replicated execution entities.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCardCodexAdmissionCount, withCardCodexAdmission } from '@backend/business/codex/helper/card-codex-admission-lock.js';
import { projectCardCodexRun } from '@backend/business/codex/helper/project-card-codex-run.js';

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

test('non-thread projections preserve the durable thread session without creating a card lease', () => {
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
  assert.equal(card.codexRunId, undefined);
});
