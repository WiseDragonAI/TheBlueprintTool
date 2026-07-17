import assert from 'node:assert/strict';
import test from 'node:test';
import { isGlobalProjectEndpoint, isProjectSensitiveEndpoint, parseProjectUrlScope } from '@backend/business/server/helper/project-url-scope.js';

test('parses encoded project URL scope without accepting malformed ids', () => {
  assert.deepEqual(parseProjectUrlScope('/p/dev%2Fproject-a/decision-os/specs'), { projectId: 'dev/project-a', scopedPath: '/decision-os/specs' });
  assert.deepEqual(parseProjectUrlScope('/p/a/control-room'), { projectId: 'a', scopedPath: '/control-room' });
  assert.equal(parseProjectUrlScope('/p/%E0%A4%A/control-room'), null);
  assert.equal(parseProjectUrlScope('/projects'), null);
});

test('separates global endpoints from project-sensitive endpoints', () => {
  assert.equal(isGlobalProjectEndpoint('/decision-os/projects/a'), true);
  assert.equal(isGlobalProjectEndpoint('/api/server/restart'), true);
  assert.equal(isGlobalProjectEndpoint('/api/federation/libraries/synchronize'), true);
  assert.equal(isGlobalProjectEndpoint('/api/codex/server-skills/example'), true);
  assert.equal(isProjectSensitiveEndpoint('/decision-os/specs'), true);
  assert.equal(isProjectSensitiveEndpoint('/api/codex/skills'), true);
  assert.equal(isProjectSensitiveEndpoint('/.decision-os/thread-files/a.png'), true);
  assert.equal(isProjectSensitiveEndpoint('/assets/mobile.css'), false);
});
