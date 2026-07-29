import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decisionOsReleaseHealthIdentity } from '../../src/business/server/helper/read-decision-os-settings.js';
import { launcherEmergencyHealthPayload } from '../../../bin/decision-os-launcher-emergency.mjs';

const releaseSha = 'a'.repeat(40);

test('normal, startup, and launcher emergency health share release and process identity fields', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-release-health-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const release = join(root, 'releases', releaseSha);
  mkdirSync(release, { recursive: true });
  writeFileSync(join(release, '.decision-os-release.json'), `${JSON.stringify({ protocol: 1, releaseSha, launcher: 'bin/decision-os-server.mjs' })}\n`);
  symlinkSync(join('releases', releaseSha), join(root, 'current'));
  const previousStartedAt = process.env.DECISION_OS_PROCESS_STARTED_AT;
  const previousReleaseSha = process.env.DECISION_OS_RELEASE_SHA;
  const previousProtocol = process.env.DECISION_OS_DELIVERY_PROTOCOL;
  const previousPointer = process.env.DECISION_OS_ACTIVE_RELEASE_POINTER;
  process.env.DECISION_OS_PROCESS_STARTED_AT = '2026-07-28T00:00:00.000Z';
  process.env.DECISION_OS_RELEASE_SHA = releaseSha;
  process.env.DECISION_OS_DELIVERY_PROTOCOL = '1';
  context.after(() => {
    if (previousStartedAt === undefined) delete process.env.DECISION_OS_PROCESS_STARTED_AT;
    else process.env.DECISION_OS_PROCESS_STARTED_AT = previousStartedAt;
    if (previousReleaseSha === undefined) delete process.env.DECISION_OS_RELEASE_SHA;
    else process.env.DECISION_OS_RELEASE_SHA = previousReleaseSha;
    if (previousProtocol === undefined) delete process.env.DECISION_OS_DELIVERY_PROTOCOL;
    else process.env.DECISION_OS_DELIVERY_PROTOCOL = previousProtocol;
    if (previousPointer === undefined) delete process.env.DECISION_OS_ACTIVE_RELEASE_POINTER;
    else process.env.DECISION_OS_ACTIVE_RELEASE_POINTER = previousPointer;
  });
  const identity = decisionOsReleaseHealthIdentity({
    deliveryProtocol: 1,
    deliveryReleaseRoot: root,
    deliveryCurrentPointer: join(root, 'current'),
  });
  assert.deepEqual(identity, {
    releaseSha,
    processStartedAt: '2026-07-28T00:00:00.000Z',
    deliveryProtocol: 1,
    activeReleasePointer: `current:${releaseSha}`,
  });
  process.env.DECISION_OS_RELEASE_SHA = 'b'.repeat(40);
  process.env.DECISION_OS_ACTIVE_RELEASE_POINTER = `current:${'b'.repeat(40)}`;
  assert.equal(decisionOsReleaseHealthIdentity({
    deliveryProtocol: 1,
    deliveryReleaseRoot: root,
    deliveryCurrentPointer: join(root, 'current'),
  }).releaseSha, releaseSha);
  const emergency = launcherEmergencyHealthPayload({
    releaseIdentity: identity,
    incidentLedger: '/fixture/incidents.json',
    incidentPersistenceError: '',
    activeIncidentCount: 1,
  });
  for (const field of ['releaseSha', 'processStartedAt', 'deliveryProtocol', 'activeReleasePointer']) {
    assert.equal(emergency[field], identity[field]);
  }
});
