/**
 * WHAT: Verifies generated pipeline outputs resolve one structural parent and collision-free positions.
 * WHY: Skill results must be direct siblings in the task graph even when execution starts from a subtask.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePipelineOutputParent } from '../../../src/business/codex/helper/resolve-pipeline-output-parent.js';

test('resolves a Tasks subtask to its canonical master and appends after existing positions', () => {
  const resolved = resolvePipelineOutputParent({
    ledgerId: 'tasks',
    sourceCardId: 'source-child',
    ledger: {
      cards: [
        { id: 'master', labels: ['master-task'] },
        { id: 'source-child', labels: ['subtask'] },
        { id: 'existing-child', labels: ['subtask'] },
      ],
      relationships: [
        { id: 'source-link', from: 'master', to: 'source-child', label: 'subtask', position: 0 },
        { id: 'existing-link', from: 'master', to: 'existing-child', label: 'subtask', position: 3 },
      ],
    },
  });

  assert.deepEqual(resolved, {
    outputParentCardId: 'master',
    firstOutputSubtaskPosition: 4,
  });
});

test('uses the selected source as the parent outside Tasks and appends positioned outputs', () => {
  const resolved = resolvePipelineOutputParent({
    ledgerId: 'specs',
    sourceCardId: 'source',
    ledger: {
      cards: [{ id: 'source' }, { id: 'existing' }],
      relationships: [
        { id: 'existing-link', from: 'source', to: 'existing', label: 'subtask', position: 2 },
      ],
    },
  });

  assert.deepEqual(resolved, {
    outputParentCardId: 'source',
    firstOutputSubtaskPosition: 3,
  });
});

test('rejects a Tasks root that is not a canonical master task', () => {
  assert.throws(() => resolvePipelineOutputParent({
    ledgerId: 'tasks',
    sourceCardId: 'unclassified',
    ledger: {
      cards: [{ id: 'unclassified', labels: [] }],
      relationships: [],
    },
  }), /task_master_label_missing/);
});
