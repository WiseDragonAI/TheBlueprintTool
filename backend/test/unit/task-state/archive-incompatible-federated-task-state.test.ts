/**
 * WHAT: Verifies incompatible derived task-state bytes are archived exactly before relay rebuild.
 * WHY: Cache recovery is safe only when rejected evidence survives and the active path becomes installable.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { archiveIncompatibleFederatedTaskState } from '../../../src/business/task-state/helper/archive-incompatible-federated-task-state.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

test('archives the exact incompatible cache and leaves its active root ready for a compatible rebuild', async (context) => {
  const replicaDecisionOsRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-federated-cache-recovery-'));
  context.after(() => rmSync(replicaDecisionOsRoot, { recursive: true, force: true }));
  const projectId = 'remote-project';
  const activeRoot = resolve(replicaDecisionOsRoot, 'task-state', projectId);
  const formatBytes = Buffer.from('{"version":2,"projectId":"remote-project"}\n');
  const entityBytes = Buffer.from('{"version":2,"entityId":"card-a"}\n');
  mkdirSync(resolve(activeRoot, 'current', 'card'), { recursive: true });
  writeFileSync(resolve(activeRoot, 'format.json'), formatBytes);
  writeFileSync(resolve(activeRoot, 'current', 'card', 'card-a.json'), entityBytes);

  const archived = await archiveIncompatibleFederatedTaskState({ replicaDecisionOsRoot, projectId });
  assert.equal(archived.fingerprint.length, 64);
  assert.equal(existsSync(activeRoot), false);
  assert.deepEqual(readFileSync(resolve(archived.archiveRoot, 'format.json')), formatBytes);
  assert.deepEqual(readFileSync(resolve(archived.archiveRoot, 'current', 'card', 'card-a.json')), entityBytes);

  const rebuilt = createTaskCurrentStateStore({
    decisionOsRoot: replicaDecisionOsRoot,
    projectId,
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  assert.equal(rebuilt.projection().projectId, projectId);
  assert.equal(existsSync(resolve(activeRoot, 'format.json')), true);
  assert.deepEqual(readFileSync(resolve(archived.archiveRoot, 'format.json')), formatBytes);
});

test('rejects a project identifier that can escape derived cache storage', async (context) => {
  const container = mkdtempSync(resolve(tmpdir(), 'decision-os-federated-cache-scope-'));
  context.after(() => rmSync(container, { recursive: true, force: true }));
  const replicaDecisionOsRoot = resolve(container, 'cache');
  const outside = resolve(container, 'outside');
  mkdirSync(outside, { recursive: true });
  writeFileSync(resolve(outside, 'format.json'), '{"version":2}\n');

  await assert.rejects(
    archiveIncompatibleFederatedTaskState({ replicaDecisionOsRoot, projectId: '../outside' }),
    /invalid_federated_task_state_project_id/,
  );
  assert.equal(existsSync(resolve(outside, 'format.json')), true);
});
