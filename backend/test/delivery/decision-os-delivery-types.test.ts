import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deliveryExitCodeForStatus,
  parseDeliveryNodeCommand,
  parseDeliveryNodeReceipt,
  parseDeliveryRun,
  redactDeliveryCommandArguments,
} from '../../../shared/schemas/decision-os-delivery-types.js';
import {
  admittedSha,
  deliveryNodeReceipt,
  deliveryRun,
  priorSha,
} from './delivery-test-fixtures.js';

test('protocol 1 fixes node actions and terminal exit mapping', () => {
  assert.deepEqual(parseDeliveryNodeCommand({
    deliveryId: 'delivery-test-1',
    action: 'prepare',
    targetCommit: admittedSha,
    expectedCommit: priorSha,
  }), {
    deliveryId: 'delivery-test-1',
    action: 'prepare',
    targetCommit: admittedSha,
    expectedCommit: priorSha,
  });
  assert.equal(deliveryExitCodeForStatus('running'), null);
  assert.equal(deliveryExitCodeForStatus('complete'), 0);
  assert.equal(deliveryExitCodeForStatus('admission-rejected'), 2);
  assert.equal(deliveryExitCodeForStatus('paused'), 3);
  assert.equal(deliveryExitCodeForStatus('rolled-back-runtime'), 3);
  assert.equal(deliveryExitCodeForStatus('partial'), 3);
  assert.equal(deliveryExitCodeForStatus('compensation-failed'), 4);
});

test('strict schemas reject unknown actions, fields, future protocols, and inconsistent terminal state', () => {
  assert.throws(() => parseDeliveryNodeCommand({
    deliveryId: 'delivery-test-1',
    action: 'shell',
    targetCommit: admittedSha,
    expectedCommit: priorSha,
  }));
  assert.throws(() => parseDeliveryNodeCommand({
    deliveryId: 'delivery-test-1',
    action: 'prepare',
    targetCommit: admittedSha,
    expectedCommit: priorSha,
    command: 'rm',
  }));
  assert.throws(() => parseDeliveryRun({ ...deliveryRun(), protocol: 2 }));
  assert.throws(() => parseDeliveryRun({ ...deliveryRun(), unknown: true }));
  assert.throws(() => parseDeliveryRun(deliveryRun({ status: 'complete', phase: 'preflight' })));
  assert.throws(() => parseDeliveryNodeReceipt(deliveryNodeReceipt({
    status: 'failed',
    error: null,
  })));
});

test('command evidence is bounded and rejects unredacted sensitive values', () => {
  assert.deepEqual(
    redactDeliveryCommandArguments(['wrangler', '--api-token=secret', 'Authorization: Bearer value']),
    ['wrangler', '[REDACTED]', '[REDACTED]'],
  );
  assert.throws(() => parseDeliveryNodeReceipt(deliveryNodeReceipt({
    command: {
      redactedArguments: ['--api-token=secret'],
      stdoutArtifact: 'artifacts/stdout.log',
      stderrArtifact: 'artifacts/stderr.log',
    },
  })));
  assert.equal(parseDeliveryNodeReceipt(deliveryNodeReceipt({
    command: {
      redactedArguments: ['wrangler', '[REDACTED]'],
      stdoutArtifact: 'artifacts/stdout.log',
      stderrArtifact: 'artifacts/stderr.log',
    },
  })).command?.redactedArguments[1], '[REDACTED]');
});
