/** WHAT: Covers independent responsive thread-document ownership. WHY: Navigation projections must never erase a hydrated conversation. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { state } from '../src/runtime/state.js';
import {
  installThreadDocumentState,
  restoreThreadDocumentsIntoLedger,
  threadDocumentState,
} from '../src/runtime/thread/helper/thread-document-state.js';

test('a navigation-only ledger restores its independently owned thread document', () => {
  state.threadDocumentsByScope = {};
  const scope = {
    projectId: 'project-a',
    replicaNodeId: 'workstation',
    ledgerId: 'tasks',
    threadId: 'thread-card-a',
    contentFile: '.decision-os/threads/tasks/thread-card-a.md',
  };
  installThreadDocumentState(scope, {
    contentFile: scope.contentFile,
    notes: [{ id: 'note-a', role: 'operator', message: 'Retained' }],
    deletedNoteIds: ['note-deleted'],
  });

  const navigationLedger = {
    cards: [{ id: 'card-a', title: 'Card A' }],
    annotations: [],
    relationships: [],
    notes: {
      [scope.threadId]: [{ id: 'note-pending', role: 'operator', message: 'Pending locally', optimistic: true }],
    },
  };
  restoreThreadDocumentsIntoLedger({
    projectId: scope.projectId,
    replicaNodeId: scope.replicaNodeId,
    ledgerId: scope.ledgerId,
    ledger: navigationLedger,
  });

  assert.equal(navigationLedger.threadFiles[scope.threadId], scope.contentFile);
  assert.deepEqual(navigationLedger.notes[scope.threadId], [
    { id: 'note-a', role: 'operator', message: 'Retained' },
    { id: 'note-pending', role: 'operator', message: 'Pending locally', optimistic: true },
  ]);
  assert.deepEqual(navigationLedger.deletedNoteIds[scope.threadId], ['note-deleted']);
  navigationLedger.notes[scope.threadId][0].message = 'Local projection changed';
  assert.equal(threadDocumentState(scope).notes[0].message, 'Retained');
  assert.equal(threadDocumentState(scope).notes[1].message, 'Pending locally');
});

test('thread documents remain scoped to their project, replica, and ledger', () => {
  state.threadDocumentsByScope = {};
  const scope = {
    projectId: 'project-a',
    replicaNodeId: 'phone',
    ledgerId: 'tasks',
    threadId: 'thread-card-a',
    contentFile: '.decision-os/threads/tasks/thread-card-a.md',
  };
  installThreadDocumentState(scope, {
    contentFile: scope.contentFile,
    notes: [{ id: 'note-a' }],
    deletedNoteIds: [],
  });
  const otherLedger = { cards: [] };
  restoreThreadDocumentsIntoLedger({
    projectId: 'project-a',
    replicaNodeId: 'workstation',
    ledgerId: 'tasks',
    ledger: otherLedger,
  });
  assert.equal(otherLedger.notes, undefined);
});
