import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodexPipelineRun } from '../../../shared/schemas/codex-pipeline-types.js';
import { createCodexPipelineStepCards } from '@backend/business/codex/effect/create-codex-pipeline-step-cards.js';

test('run-owned createStepCards false skips automatic card and relationship creation', async () => {
  const ledger = {
    cards: [{ id: 'source-card', title: 'Source' }],
    relationships: [],
  };
  const before = structuredClone(ledger);

  const result = await createCodexPipelineStepCards({
    decisionOsRoot: '/unused',
    context: {
      ledgerId: 'tasks',
      ledgerPath: '/unused/tasks.json',
      ledger,
      runtime: { decisionOsSettings: { createPipelineStepCards: true } },
    },
    run: { createStepCards: false } as CodexPipelineRun,
  });

  assert.equal(result, null);
  assert.deepEqual(ledger, before);
});
