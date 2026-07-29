/** WHAT: Preserves canonical responsive project resource routes. WHY: Compact views and desktop canvas views must address the same identities. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { cardPathForProject, isProjectCardPath, ledgerPathForProject, parseProjectRoute, parseProjectScope, projectPath, zonePathForProject } from '../src/app/responsive/project-route.js';

test('parses project index and detail routes', () => {
  assert.deepEqual(parseProjectRoute('/projects'), { view: 'index', projectId: '' });
  assert.deepEqual(parseProjectRoute('/projects/target'), { view: 'detail', projectId: 'target' });
  assert.deepEqual(parseProjectRoute('/projects/alpha/extra'), { view: 'invalid', projectId: '' });
  assert.equal(parseProjectRoute('/ledgers'), null);
});

test('builds the complete encoded project route hierarchy', () => {
  assert.deepEqual(parseProjectScope('/p/dev%2Fproject%20a/ledgers/specs'), { projectId: 'dev/project a', segments: ['ledgers', 'specs'] });
  assert.equal(projectPath(), '/projects');
  assert.equal(projectPath('dev/project a'), '/projects/dev%2Fproject%20a');
  assert.equal(ledgerPathForProject('dev/project a', 'specs'), '/p/dev%2Fproject%20a/ledgers/specs');
  assert.equal(zonePathForProject('a', 'specs', 'zone 1'), '/p/a/ledgers/specs/zones/zone%201');
  assert.equal(cardPathForProject('a', 'specs', 'zone 1', 'card/1'), '/p/a/ledgers/specs/cards/card%2F1');
  assert.equal(cardPathForProject('a', 'specs', 'card/1'), '/p/a/ledgers/specs/cards/card%2F1');
  assert.equal(isProjectCardPath('/p/a/ledgers/specs/cards/card%2F1'), true);
  assert.equal(isProjectCardPath('/p/a/ledgers/specs/zones/zone%201/cards/card%2F1'), true);
  assert.equal(isProjectCardPath('/p/a/ledgers/specs'), false);
  assert.equal(isProjectCardPath('/projects'), false);
});
