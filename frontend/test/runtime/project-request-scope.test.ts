import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScopedRequestPath } from '../../src/runtime/project/helper/project-request-scope.js';

const projectId = 'project-id';

test('projectScopedRequestPath canonicalizes legacy and root-relative Decision OS assets', () => {
  assert.equal(
    projectScopedRequestPath('.decision-os/thread-images/thread-card-a/paste.png', projectId),
    '/p/project-id/.decision-os/thread-images/thread-card-a/paste.png'
  );
  assert.equal(
    projectScopedRequestPath('/.decision-os/thread-images/thread-card-a/paste.png', projectId),
    '/p/project-id/.decision-os/thread-images/thread-card-a/paste.png'
  );
});

test('projectScopedRequestPath preserves external and already scoped URLs', () => {
  const originalLocation = globalThis.location;
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://decision-os.local/p/project-id/ledgers/specs')
  });
  try {
    assert.equal(
      projectScopedRequestPath('https://assets.example.com/image.png', projectId),
      'https://assets.example.com/image.png'
    );
    assert.equal(
      projectScopedRequestPath('/p/project-id/.decision-os/thread-images/thread-card-a/paste.png', projectId),
      '/p/project-id/.decision-os/thread-images/thread-card-a/paste.png'
    );
  } finally {
    if (originalLocation === undefined) delete (globalThis as { location?: Location }).location;
    else Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  }
});
