import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildFederationTaskReplica, createFederationTaskReplicaCache } from '../../../src/business/federation/helper/federation-task-replica.js';
import type { DecisionOsProject } from '../../../src/business/server/helper/project-catalog.js';

const decisionOsRoot = '/workspace/.decision-os';
const project: DecisionOsProject = {
  id: 'project-a',
  name: 'A',
  description: '',
  color: '#38d9e8',
  relativePath: 'a',
  root: '/workspace',
  decisionOsRoot,
  ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  available: true,
  diagnostic: '',
};

function projection(fingerprint = 'fingerprint-a') {
  return {
    projectSlices: [{ projectId: project.id, fingerprint }],
    allTasks: [{
      projectId: project.id,
      ledgerId: 'specs',
      cardId: 'card-a',
      status: 'task-waiting',
      subtasks: [{ cardId: 'card-b' }],
    }],
  };
}

test('builds a task replica from one ledger parse and one read per selected content resource', () => {
  const ledgerPath = resolve(decisionOsRoot, 'specs.json');
  const files = new Map<string, string>([
    [ledgerPath, JSON.stringify({
      id: 'specs',
      cards: [
        { id: 'card-a', title: 'A', status: 'todo', comment: { contentFile: '.decision-os/cards/specs/card-a.md' } },
        { id: 'card-b', title: 'B', status: 'todo', comment: { contentFile: '.decision-os/cards/specs/card-b.md' } },
      ],
      annotations: [],
      relationships: [{ id: 'rel-a-b', from: 'card-a', to: 'card-b', label: 'subtask' }],
      threadFiles: {
        'thread-card-a': '.decision-os/threads/specs/thread-card-a.md',
        'thread-card-b': '.decision-os/threads/specs/thread-card-b.md',
      },
    })],
    [resolve(decisionOsRoot, 'cards/specs/card-a.md'), 'Card A body'],
    [resolve(decisionOsRoot, 'cards/specs/card-b.md'), 'Card B body'],
    [resolve(decisionOsRoot, 'threads/specs/thread-card-a.md'), '# OPERATOR\n\nA note\n'],
    [resolve(decisionOsRoot, 'threads/specs/thread-card-b.md'), '# AGENT\n\nB note\n'],
  ]);
  const reads = new Map<string, number>();
  const snapshot = buildFederationTaskReplica({
    project,
    projection: projection(),
    fileSystem: {
      exists: (file) => files.has(file),
      readText: (file) => {
        reads.set(file, (reads.get(file) ?? 0) + 1);
        const value = files.get(file);
        if (value === undefined) throw new Error(`Unexpected read: ${file}`);
        return value;
      },
    },
  });

  assert.equal(reads.get(ledgerPath), 1);
  assert.equal(reads.has(resolve(decisionOsRoot, 'state.json')), false);
  assert.deepEqual([...reads.values()], [1, 1, 1, 1, 1]);
  assert.equal((snapshot.ledgers.specs.cards['card-a'].comment as Record<string, unknown>).what, 'Card A body');
  assert.equal((snapshot.ledgers.specs.threads['thread-card-b'].notes as Record<string, Array<{ message: string }>>)['thread-card-b'][0].message, 'B note');
});

test('reuses the immutable snapshot until the project-slice fingerprint changes', () => {
  let builds = 0;
  const cache = createFederationTaskReplicaCache({
    build: (input) => {
      builds += 1;
      return {
        version: 1,
        revision: `revision-${builds}`,
        generatedAt: `2026-07-18T00:00:0${builds}.000Z`,
        project: input.project,
        controlRoom: { allTasks: [] },
        state: {},
        ledgers: {},
      };
    },
  });

  const first = cache.get({ project, projection: projection('one') });
  const retained = cache.get({ project, projection: projection('one') });
  const changed = cache.get({ project, projection: projection('two') });

  assert.equal(retained, first);
  assert.notEqual(changed, first);
  assert.equal(builds, 2);
});
