import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodexPipelineRun } from '../../../shared/schemas/codex-pipeline-types.js';
import { createCodexPipelineStepCards } from '@backend/business/codex/effect/create-codex-pipeline-step-cards.js';

test('an admitted cardless run skips automatic card and relationship creation', async () => {
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
      runtime: {},
    },
    run: {
      id: 'pipeline-run',
      pipelineId: 'pipeline',
      pipelineName: 'Pipeline',
      temporary: false,
      createStepCards: false,
      executionMode: 'local',
      ledgerId: 'tasks',
      sourceCardId: 'source-card',
      sourceCardTitle: 'Source',
      outputParentCardId: 'source-card',
      status: 'pending',
      steps: [],
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      resumedAt: null,
      error: '',
    } satisfies CodexPipelineRun,
  });

  assert.equal(result, null);
  assert.deepEqual(ledger, before);
});
