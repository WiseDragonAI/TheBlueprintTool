import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPipelineSubtasks, buildPipelineSubtaskContext } from '@backend/business/codex/helper/build-pipeline-subtask-context.js';

test('pipeline subtask context renders every canonical subtask in positioned order', () => {
  const markdown = buildPipelineSubtaskContext({
    masterTaskId: 'master-task',
    ledger: {
      cards: [
        { id: 'subtask-later', title: 'Later task', status: 'todo', comment: { what: 'Later body.' } },
        { id: 'master-task', title: 'Master task', labels: ['master-task'] },
        { id: 'subtask-first', title: 'First task', status: 'done', comment: { what: 'First **body**.' } },
      ],
      relationships: [
        { id: 'relationship-later', from: 'master-task', to: 'subtask-later', label: 'subtask', position: 2 },
        { id: 'relationship-unrelated', from: 'other-task', to: 'other-subtask', label: 'subtask', position: 0 },
        { id: 'relationship-first', from: 'master-task', to: 'subtask-first', label: 'subtask', position: 0 },
        { id: 'relationship-missing', from: 'master-task', to: 'subtask-missing', label: 'subtask' },
      ],
    },
  });

  assert.match(markdown, /^## Subtask 1: First task/);
  assert.match(markdown, /First \*\*body\*\*\.[\s\S]*## Subtask 2: Later task[\s\S]*Later body\./);
  assert.match(markdown, /## Subtask 3: Missing card subtask-missing/);
  assert.match(markdown, /The subtask relationship target is missing from the ledger projection\./);
  assert.doesNotMatch(markdown, /other-subtask/);
});

test('pipeline subtask context reports an empty canonical task graph', () => {
  assert.equal(
    buildPipelineSubtaskContext({ masterTaskId: 'master-task', ledger: { cards: [], relationships: [] } }),
    '_No canonical subtasks are linked to this task._',
  );
});

test('pipeline subtasks render canonical titles and facts without task content', () => {
  const markdown = buildPipelineSubtasks({
    masterTaskId: 'master-task',
    ledger: {
      cards: [
        { id: 'subtask-later', title: 'Later task', facts: ['Later fact'], comment: { what: 'Later body.' } },
        { id: 'subtask-first', title: 'First task', facts: ['First fact', 'Second fact'], comment: { what: 'First body.' } },
        { id: 'subtask-empty', title: 'Empty facts', facts: [], comment: { what: 'Hidden body.' } },
      ],
      relationships: [
        { id: 'relationship-later', from: 'master-task', to: 'subtask-later', label: 'subtask', position: 2 },
        { id: 'relationship-first', from: 'master-task', to: 'subtask-first', label: 'subtask', position: 0 },
        { id: 'relationship-empty', from: 'master-task', to: 'subtask-empty', label: 'subtask', position: 1 },
      ],
    },
  });

  assert.equal(markdown, [
    '## First task',
    '- First fact',
    '- Second fact',
    '',
    '---',
    '',
    '## Empty facts',
    '',
    '---',
    '',
    '## Later task',
    '- Later fact',
  ].join('\n'));
  assert.doesNotMatch(markdown, /body|Card ID|Status|Position/);
});
