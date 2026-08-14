/**
 * WHAT: Verifies federation repair timeout containment at the server runtime boundary.
 * WHY: A stopped remote repair must not revoke valid local task-state authority.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createFederationStateRuntime } from '../../../src/business/federation/runtime/federation-state-runtime.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion } from '../../../src/business/task-state/helper/task-current-state-types.js';

function storeFixture(prefix: string) {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  return { root, store };
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
  assert.equal(predicate(), true);
}

test('no-progress stops only the remote repair and leaves local mutation admitted', async (context) => {
  const source = storeFixture('decision-os-state-runtime-source-');
  const target = storeFixture('decision-os-state-runtime-target-');
  context.after(async () => {
    await Promise.all([source.store.flush(), target.store.flush()]);
    rmSync(source.root, { recursive: true, force: true });
    rmSync(target.root, { recursive: true, force: true });
  });
  await source.store.mutate({ replicaId: 'source', changes: [{ entityType: 'card', entityId: 'remote', changes: [{ path: 'title', operation: 'set', value: 'Remote' }] }] });
  const stopped: Array<Record<string, unknown>> = [];
  const pausedTaskProjects = new Map();
  const projectState = {
    store: target.store,
    reconcileMergeableConflicts: async () => ({ changed: false, localChanges: [] }),
  };
  const runtime = createFederationStateRuntime({
    contentStore: {} as never,
    executionStateForProject: () => null,
    federatedProjectStates: new Map(),
    federation: () => ({
      publishStateFrame: () => true,
      remoteProjects: () => [],
      localOwner: () => ({ ownerNodeId: 'workstation' }),
    }) as never,
    globalClients: new Set(),
    invalidateProject: () => undefined,
    localTaskRuntime: { scheduleContentHeadRepair: () => undefined } as never,
    pausedFederationRepairs: new Map(),
    pausedTaskProjects,
    presentations: {} as never,
    projectCatalogStore: { projects: () => [] } as never,
    projectContexts: new Map(),
    projectStates: new Map([['project-a', projectState as never]]),
    publishExecutionChange: () => undefined,
    repairNoProgressTimeoutMs: 20,
    recordBackgroundFailure: () => undefined,
    recordIncident: () => { throw new Error('repair_timeout_must_not_record_a_pausing_incident'); },
    recordStoppedOperation: (operation) => { stopped.push(operation); return 'stopped'; },
    scheduleCodex: async () => undefined,
    taskStoreForProject: () => target.store,
  });

  await runtime.replicator.handleFrame({
    type: 'state-bucket-summary',
    from: 'relay',
    projectId: 'project-a',
    payload: { stateVersion: taskCurrentStateVersion, root: source.store.rootHash(), buckets: source.store.bucketManifest() },
  });
  await waitFor(() => stopped.length === 1);

  assert.equal(stopped[0].scope, 'federation-repair-attempt:project-a:relay');
  assert.equal(stopped[0].code, 'federation_state_no_progress');
  assert.equal(pausedTaskProjects.has('project-a'), false);
  assert.equal(runtime.replicator.diagnostics().activeRepairCount, 0);
  const local = await target.store.mutate({
    replicaId: 'workstation',
    changes: [{ entityType: 'card', entityId: 'local', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }],
  });
  assert.equal(local.delta.entities.length, 1);
});
