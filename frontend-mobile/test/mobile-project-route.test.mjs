import assert from 'node:assert/strict';
import test from 'node:test';
import { cardPathForProject, ledgerPathForProject, parseProjectRoute, parseProjectScope, projectPath, zonePathForProject } from '../src/mobile-project-route.js';

test('parses project index and detail routes', () => {
  assert.deepEqual(parseProjectRoute('/p/current/projects'), { view: 'index', contextProjectId: 'current', projectId: '' });
  assert.deepEqual(parseProjectRoute('/p/current/projects/target'), { view: 'detail', contextProjectId: 'current', projectId: 'target' });
  assert.deepEqual(parseProjectRoute('/p/current/projects/alpha/extra'), { view: 'invalid', contextProjectId: 'current', projectId: '' });
  assert.equal(parseProjectRoute('/ledgers'), null);
});

test('builds the complete encoded project route hierarchy', () => {
  assert.deepEqual(parseProjectScope('/p/dev%2Fproject%20a/ledgers/specs'), { projectId: 'dev/project a', segments: ['ledgers', 'specs'] });
  assert.equal(projectPath('current'), '/p/current/projects');
  assert.equal(projectPath('current', 'dev/project a'), '/p/current/projects/dev%2Fproject%20a');
  assert.equal(ledgerPathForProject('dev/project a', 'specs'), '/p/dev%2Fproject%20a/ledgers/specs');
  assert.equal(zonePathForProject('a', 'specs', 'zone 1'), '/p/a/ledgers/specs/zones/zone%201');
  assert.equal(cardPathForProject('a', 'specs', 'zone 1', 'card/1'), '/p/a/ledgers/specs/zones/zone%201/cards/card%2F1');
});
