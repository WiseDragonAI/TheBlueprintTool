/**
 * WHAT: Locks the operator-visible candidate, rollback, routing, and authoring contracts.
 * WHY: Delivery documentation must name only executable commands and implemented stable response shapes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(file), 'utf8');

test('delivery and canary runbooks expose the fixed candidate and live rollback contracts', () => {
  const production = read('documentation/procedure/deployment/production-delivery-protocol.md');
  const canary = read('documentation/procedure/deployment/canary-skill-authoring-dev-environment.md');
  assert.match(production, /decision-os-delivery\.mjs candidate[\s\S]*--release-sha <40-character-origin-dev-sha>[\s\S]*--json/);
  assert.match(production, /live relay `\/health`[\s\S]*exact predecessor `releaseSha`[\s\S]*`environment: "production"`/);
  assert.match(production, /Pure local parsing and journal reads do not create redundant phase receipts/);
  assert.match(canary, /releaseSha: ""[\s\S]*deliveryProtocol: 0[\s\S]*activeReleasePointer: "unbootstrapped"/);
  assert.match(canary, /multiwezterm-process unregister[\s\S]*multiwezterm-process register[\s\S]*curl -sS http:\/\/127\.0\.0\.1:50151\/api\/health[\s\S]*decision-os-delivery\.mjs candidate/);
  assert.match(canary, /127\.0\.0\.1:50150\/decision-os\/projects/);
  assert.doesNotMatch(canary, /127\.0\.0\.1:50150\/projects/);
});

test('authoring architecture uses implemented retry and nested collision contracts', () => {
  const authoring = read('documentation/documentation/architecture/codex-content-authoring.md');
  assert.match(authoring, /conflict: \{contentKind, sourceClass, projectId\}/);
  assert.match(authoring, /`invalid_revision_retry`/);
  assert.doesNotMatch(authoring, /`invalid_recovery_token`/);
  assert.doesNotMatch(authoring, /non-Markdown input/);
});
