import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireVoiceCaptureOwnership,
  currentVoiceCaptureOwner,
  releaseVoiceCaptureOwnership,
} from '../../../../src/runtime/voice/helper/voice-capture-ownership.js';

test('voice capture ownership is an exclusive opaque lease', () => {
  const lease = acquireVoiceCaptureOwnership('git-review:card-a:file-a');
  assert.ok(lease);
  try {
    assert.equal(currentVoiceCaptureOwner(), 'git-review:card-a:file-a');
    assert.equal(acquireVoiceCaptureOwnership('git-review:card-a:file-a'), null);
    assert.equal(acquireVoiceCaptureOwnership('thread'), null);

    const forgedLease = { owner: lease.owner, token: Symbol(lease.owner) } as const;
    assert.equal(releaseVoiceCaptureOwnership(forgedLease), false);
    assert.equal(currentVoiceCaptureOwner(), 'git-review:card-a:file-a');
    assert.equal(releaseVoiceCaptureOwnership(lease), true);
    assert.equal(currentVoiceCaptureOwner(), null);
  } finally {
    releaseVoiceCaptureOwnership(lease);
  }
});
