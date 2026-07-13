import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProjectRoute, projectPath } from '../src/mobile-project-route.js';

test('parses project index and detail routes', () => {
  assert.deepEqual(parseProjectRoute('/projects'), { view: 'index', projectId: '' });
  assert.deepEqual(parseProjectRoute('/projects/ZGV2L3Byb2plY3QtYQ'), { view: 'detail', projectId: 'ZGV2L3Byb2plY3QtYQ' });
  assert.deepEqual(parseProjectRoute('/projects/alpha/extra'), { view: 'invalid', projectId: '' });
  assert.equal(parseProjectRoute('/ledgers'), null);
});

test('builds encoded project paths', () => {
  assert.equal(projectPath(), '/projects');
  assert.equal(projectPath('dev/project a'), '/projects/dev%2Fproject%20a');
});
