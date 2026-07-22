import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectSyncController } from '../../../src/business/project-sync/controller/start-project-sync.js';
import type { ProjectSyncRun } from '../../../src/business/project-sync/helper/project-sync-types.js';

test('project synchronization contains failures from its durable failure-recording path', async () => {
  const run: ProjectSyncRun = {
    syncId: 'sync-a',
    idempotencyKey: 'sync-a',
    initiatorNodeId: 'workstation',
    sourceNodeId: 'workstation',
    initiatorProjectId: 'project-a',
    sourceProjectId: 'project-a',
    sourceProjectName: 'Project A',
    sourceProjectColor: '#123456',
    originFingerprint: 'origin-a',
    taskProjectId: 'project-a',
    ledgerId: 'tasks',
    masterCardId: 'card-a',
    pipelineRunId: 'pipeline-a',
    preparationPhase: 'attached',
    phase: 'preflight',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    evidence: {},
    error: null,
  };
  const reported = new Promise<{ error: unknown; context: { syncId: string; operation: string } }>((resolve) => {
    const controller = createProjectSyncController({
      masterRoot: '/path-that-does-not-exist',
      localNodeId: () => 'workstation',
      projects: () => [{ id: 'project-a', localProjectId: 'project-a', ownerNodeId: 'workstation', available: true, root: '/path-that-does-not-exist' }] as never,
      catalog: {} as never,
      federation: { remoteProjects: () => [] } as never,
      store: {
        list: () => [run],
        read: () => run,
        transition: () => { throw new Error('injected durable-store failure'); },
      } as never,
      runtimeForProject: () => ({}),
      gitSshCommand: () => '',
      onRunChange: () => undefined,
      onBackgroundError: (error, context) => resolve({ error, context }),
    });
    controller.resume();
  });

  const failure = await reported;
  assert.match(String(failure.error), /injected durable-store failure/);
  assert.deepEqual(failure.context, { syncId: 'sync-a', operation: 'execute-project-synchronization' });
});
