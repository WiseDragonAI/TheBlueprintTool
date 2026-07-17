import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseMasterTaskMarkdown } from '../../src/app/responsive/control-room.js';

test('Control Room keeps transcribing-before-launch in Active with a distinct label', () => {
  const task = parseMasterTaskMarkdown({
    cardId: 'card-a',
    title: 'Voice task',
    labels: ['master-task'],
    ledgerId: 'specs',
    ledgerTitle: 'Specs',
    markdown: '## A. Work\n\n1. Voice launch requested.\n',
    threadNotes: [{ timestamp: '2026-07-17T11:41:45.161Z' }],
    executionStatus: 'transcribing-before-launch',
  });
  assert.equal(task.status, 'task-execution');
  assert.equal(task.transcribingBeforeLaunch, true);
  assert.equal(task.codexQueued, false);

  const application = readFileSync(new URL('../../src/app/responsive/application.js', import.meta.url), 'utf8');
  assert.match(application, /task\.transcribingBeforeLaunch/);
  assert.match(application, /Transcribing before launch/);
  assert.match(application, /transcribingBeforeLaunch[\s\S]*? transcribing/);
});
