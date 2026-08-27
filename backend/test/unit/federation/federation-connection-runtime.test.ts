/**
 * WHAT: Verifies relay repair selection and historical pipeline publication selection.
 * WHY: Cold federation recovery must retain offline repair and avoid duplicate startup presentation work.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPipelinePresentationAudienceReplay,
  createPipelinePresentationDispatchQueue,
  pipelinePresentationSnapshotIdentities,
  relayRepairProjectIds,
} from '@backend/business/federation/runtime/federation-connection-runtime.js';

function execution(executionId: string, pipelineRunId: string | null, requestedAt: string) {
  return { metadata: { executionId, pipelineRunId, requestedAt } };
}

type TestExecutionState = { executions: { all: () => Array<ReturnType<typeof execution>> } };

test('relay repair selection retains offline projects and deduplicates duplicate owners', () => {
  const projects = [
    { localProjectId: 'project-b', ownerNodeId: 'node-a', online: false },
    { localProjectId: 'project-a', ownerNodeId: 'node-a', online: false },
    { localProjectId: 'project-a', ownerNodeId: 'node-c', online: true },
  ];

  assert.deepEqual(relayRepairProjectIds(projects), ['project-a', 'project-b']);
});

test('historical pipeline publication selects the newest execution for each project-scoped run', () => {
  const states: Array<readonly [string, TestExecutionState]> = [
    ['project-a', { executions: { all: () => [
      execution('execution-a2', 'pipeline-shared', '2026-08-26T10:02:00.000Z'),
      execution('execution-a1', 'pipeline-shared', '2026-08-26T10:01:00.000Z'),
      execution('execution-direct', null, '2026-08-26T10:03:00.000Z'),
    ] } }],
    ['project-b', { executions: { all: () => [
      execution('execution-b1', 'pipeline-shared', '2026-08-26T10:04:00.000Z'),
    ] } }],
  ];
  assert.deepEqual(pipelinePresentationSnapshotIdentities(states), [
    { projectId: 'project-a', pipelineRunId: 'pipeline-shared', executionId: 'execution-a2' },
    { projectId: 'project-b', pipelineRunId: 'pipeline-shared', executionId: 'execution-b1' },
  ]);
});

test('historical pipeline publication replays only for newly admitted online audiences', () => {
  let publications = 0;
  let cancellations = 0;
  const replay = createPipelinePresentationAudienceReplay({
    publish: () => { publications += 1; },
    cancel: () => { cancellations += 1; },
  });

  replay.onCatalog([{ ownerNodeId: 'node-a', online: true }]);
  replay.onCatalog([
    { ownerNodeId: 'node-a', online: true },
    { ownerNodeId: 'node-b', online: false },
  ]);
  replay.onCatalog([
    { ownerNodeId: 'node-a', online: true },
    { ownerNodeId: 'node-b', online: true },
  ]);
  replay.onCatalog([{ ownerNodeId: 'node-a', online: true }]);
  replay.onCatalog([]);
  replay.onCatalog([{ ownerNodeId: 'node-a', online: true }]);
  replay.onDisconnected();
  replay.onCatalog([{ ownerNodeId: 'node-a', online: true }]);

  assert.equal(publications, 4);
  assert.equal(cancellations, 2);
});

test('historical pipeline dispatch yields between synchronous presentation reads', async () => {
  const published: string[] = [];
  const queue = createPipelinePresentationDispatchQueue({
    publish: (identity) => { published.push(identity.pipelineRunId); },
    recordFailure: (error) => assert.fail(error instanceof Error ? error : String(error)),
  });
  queue.dispatch([
    { projectId: 'project-a', pipelineRunId: 'pipeline-a', executionId: 'execution-a' },
    { projectId: 'project-a', pipelineRunId: 'pipeline-b', executionId: 'execution-b' },
  ]);

  assert.deepEqual(published, []);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(published, ['pipeline-a']);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(published, ['pipeline-a', 'pipeline-b']);
  queue.cancel();
});
