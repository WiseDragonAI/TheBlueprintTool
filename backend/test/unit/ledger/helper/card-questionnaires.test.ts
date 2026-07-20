import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';

const questionnaires = {
  clarification: {
    version: 1 as const,
    questions: [{
      id: 'scope',
      question: 'Which boundary should own this behavior?',
      placeholder: 'Add constraints…',
      choices: [
        { emoji: '🧭', text: 'Use the existing flow' },
        { emoji: '🧱', text: 'Create a dedicated flow' },
        { emoji: '⚖️', text: 'Combine both flows' },
        { emoji: '🧪', text: 'Validate with a prototype' },
      ] as [{ emoji: string; text: string }, { emoji: string; text: string }, { emoji: string; text: string }, { emoji: string; text: string }],
    }],
    currentQuestionId: 'scope',
    responses: {},
  },
};

test('persists a valid card questionnaire through the ledger mutation contract', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-questionnaire-'));
  try {
    const ledger: { cards: Array<Record<string, unknown>> } = { cards: [{ id: 'card-a' }] };
    const result = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'card-a', questionnaires } },
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(ledger.cards[0].questionnaires, questionnaires);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects questionnaire state that does not contain exactly four choices', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-questionnaire-'));
  try {
    const ledger: { cards: Array<Record<string, unknown>> } = { cards: [{ id: 'card-a' }] };
    const malformed = JSON.parse(JSON.stringify(questionnaires));
    malformed.clarification.questions[0].choices.pop();
    const result = applyLedgerMutation({
      decisionOsRoot: join(workspace, '.decision-os'),
      ledgerPath: join(workspace, '.decision-os', 'tasks.json'),
      ledger,
      mutation: { action: 'patch-card', cardPatch: { id: 'card-a', questionnaires: malformed } },
    });
    assert.equal(result.error?.statusCode, 400);
    assert.equal(ledger.cards[0].questionnaires, undefined);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
