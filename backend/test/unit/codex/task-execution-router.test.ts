/**
 * WHAT: Verifies assignment-aware epoch-4 launch routing, durable idempotency, and contained rejection.
 * WHY: The node serving the UI must never become an implicit executor or depend on relay convergence for local work.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  TaskExecutionAdmissionError,
  createTaskExecutionLaunchRequest,
  createTaskExecutionRouter,
  type TaskExecutionLaunchRequest,
  type TaskExecutionReceipt,
} from '../../../src/business/codex/helper/task-execution-router.js';
import { createProjectTaskState, type ProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import type { CodexPipelineRun } from '../../../../shared/schemas/codex-pipeline-types.js';
import { cancelPipelineDependents } from '../../../src/business/codex/helper/codex-pipeline-runner.js';

type Fixture = { root: string; state: ProjectTaskState };

function taskLedger(assignedNodeId = 'workstation') {
  return {
    cards: [
      {
        id: 'master',
        title: 'Master',
        status: 'todo',
        labels: ['master-task'],
        assignment: { nodeId: assignedNodeId, changedAt: '2026-07-23T01:00:00.000Z', revision: 1 },
      },
      { id: 'child', title: 'Child', status: 'todo', labels: ['subtask'] },
      { id: 'child-b', title: 'Child B', status: 'todo', labels: ['subtask'] },
    ],
    annotations: [],
    relationships: [
      { id: 'relationship-a', from: 'master', to: 'child', label: 'subtask', position: 0 },
      { id: 'relationship-b', from: 'master', to: 'child-b', label: 'subtask', position: 1 },
    ],
  };
}

function fixture(writerId: string, assignedNodeId = writerId): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), `decision-os-execution-router-${writerId}-`));
  const ledgerFile = resolve(root, 'tasks.json');
  writeFileSync(ledgerFile, JSON.stringify(taskLedger(assignedNodeId)));
  return {
    root,
    state: createProjectTaskState({
      projectId: 'project-a',
      writerId,
      decisionOsRoot: root,
      tasksLedgerFile: ledgerFile,
      initialize: true,
    }),
  };
}

function request(input: Partial<TaskExecutionLaunchRequest> = {}): TaskExecutionLaunchRequest {
  return createTaskExecutionLaunchRequest({
    requestId: 'request-a',
    executionId: 'execution-a',
    projectId: 'project-a',
    ledgerId: 'tasks',
    sessionId: 'session-a',
    sourceCardId: 'child',
    ownerCardId: 'child',
    kind: 'thread',
    requestedAt: '2026-07-23T01:01:00.000Z',
    ...input,
  });
}

async function dispose(...fixtures: Fixture[]): Promise<void> {
  await Promise.all(fixtures.map((entry) => entry.state.flush()));
  for (const entry of fixtures) rmSync(entry.root, { recursive: true, force: true });
}

test('admits a local assigned task without a peer or relay round trip and retries idempotently', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  let dispatchCount = 0;
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => {
      dispatchCount += 1;
      throw new Error('unexpected_remote_dispatch');
    },
  });

  const first = await router.route(request());
  const firstRoot = workstation.state.store.rootHash();
  const retried = await router.route(request());

  assert.deepEqual(retried, first);
  assert.equal(first.taskId, 'master');
  assert.equal(first.assignedNodeId, 'workstation');
  assert.equal(first.executorNodeId, 'workstation');
  assert.equal(first.phase, 'queued');
  assert.equal(first.revision, 2);
  assert.equal(workstation.state.store.rootHash(), firstRoot);
  assert.equal(dispatchCount, 0);
});

test('remote retry after a lost response preserves one assigned-node execution and no local execution', async (context) => {
  const workstation = fixture('workstation', 'phone');
  const phone = fixture('phone', 'phone');
  context.after(() => dispose(workstation, phone));
  const phoneRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => phone.state,
    localNodeId: () => 'phone',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  let dispatchCount = 0;
  const workstationRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: (nodeId) => nodeId === 'phone' ? { online: true } : null,
    dispatchRemote: async (nodeId, launch) => {
      assert.equal(nodeId, 'phone');
      dispatchCount += 1;
      const receipt = await phoneRouter.admitLocal(launch);
      if (dispatchCount === 1) {
        throw new TaskExecutionAdmissionError('assigned_node_unreachable', 503, { assignedNodeId: 'phone' });
      }
      return receipt;
    },
  });

  await assert.rejects(workstationRouter.route(request()), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError && error.code === 'assigned_node_unreachable'
  ));
  const admitted = await workstationRouter.route(request());
  const retried = await workstationRouter.route(request());

  assert.deepEqual(retried, admitted);
  assert.equal(dispatchCount, 3);
  assert.deepEqual(workstation.state.executions.all(), []);
  assert.equal(workstation.state.executions.byTaskId('master').length, 0);
  assert.equal(phone.state.executions.find('execution-a')?.lifecycle.phase, 'queued');
  assert.equal(phone.state.executions.find('execution-a')?.lifecycle.executorNodeId, 'phone');
  assert.equal(phone.state.executions.byTaskId('master').length, 1);
});

test('returns assigned_node_unreachable and creates no execution when the assigned peer is offline', async (context) => {
  const workstation = fixture('workstation', 'phone');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => ({ online: false }),
    dispatchRemote: async (): Promise<TaskExecutionReceipt> => { throw new Error('unexpected_remote_dispatch'); },
  });

  await assert.rejects(router.route(request()), (error: unknown) => {
    assert.ok(error instanceof TaskExecutionAdmissionError);
    assert.equal(error.code, 'assigned_node_unreachable');
    assert.equal(error.statusCode, 503);
    assert.deepEqual(error.context, { assignedNodeId: 'phone' });
    return true;
  });
  assert.deepEqual(workstation.state.executions.all(), []);
  assert.equal(workstation.state.executions.byTaskId('master').length, 0);
});

test('blocks an assignment conflict before admission and preserves the explicit conflict', async (context) => {
  const workstation = fixture('workstation');
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-router-conflict-'));
  const remote = createTaskCurrentStateStore({
    decisionOsRoot: remoteRoot,
    projectId: 'project-a',
    initializeLedger: taskLedger('workstation'),
  });
  context.after(async () => {
    await Promise.all([workstation.state.flush(), remote.flush()]);
    rmSync(workstation.root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  await workstation.state.store.mutate({
    replicaId: 'workstation',
    changes: [{
      entityType: 'card',
      entityId: 'master',
      changes: [{
        path: 'assignment',
        operation: 'set',
        value: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:30.000Z', revision: 2 },
      }],
    }],
  });
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'card',
      entityId: 'master',
      changes: [{
        path: 'assignment',
        operation: 'set',
        value: { nodeId: 'phone', changedAt: '2026-07-23T01:01:00.000Z', revision: 2 },
      }],
    }],
  });
  await workstation.state.store.merge(concurrent.delta);
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => ({ online: true }),
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });

  await assert.rejects(router.route(request()), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError && error.code === 'task_assignment_conflict'
  ));
  assert.deepEqual(workstation.state.executions.all(), []);
  assert.equal(workstation.state.projection().conflicts.some((conflict) => conflict.kind === 'assignment-conflict'), true);
});

test('persists a failed execution when local admission policy rejects after preparing', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
    validateLocal: () => { throw new TaskExecutionAdmissionError('task_session_busy', 409); },
  });

  await assert.rejects(router.route(request()), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError && error.code === 'task_session_busy'
  ));
  const failed = workstation.state.executions.find('execution-a');
  assert.equal(failed?.lifecycle.phase, 'failed');
  assert.equal(failed?.lifecycle.error?.code, 'task_session_busy');
});

test('blocks a second active direct run while allowing all skills in one pipeline topology', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  await router.route(request());

  const second = request({ requestId: 'request-b', executionId: 'execution-b', sessionId: 'session-b' });
  await assert.rejects(router.route(second), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError && error.code === 'task_execution_active'
  ));
  assert.equal(workstation.state.executions.find('execution-b')?.lifecycle.phase, 'failed');

  const pipelineFixture = fixture('workstation');
  context.after(() => dispose(pipelineFixture));
  const pipelineRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => pipelineFixture.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  const pipelineIdentity = {
    kind: 'pipeline-skill' as const,
    pipelineRunId: 'pipeline-a',
    pipelineStepId: 'step-a',
    pipelineSkillRunId: 'skill-a',
  };
  await pipelineRouter.route(request(pipelineIdentity));
  await pipelineRouter.route(request({
    ...pipelineIdentity,
    requestId: 'request-pipeline-b',
    executionId: 'execution-pipeline-b',
    pipelineStepId: 'step-b',
    pipelineSkillRunId: 'skill-b',
  }));
  assert.deepEqual(
    pipelineFixture.state.executions.byPipelineRunId('pipeline-a').map((record) => record.lifecycle.phase),
    ['queued', 'queued'],
  );
});

test('admits a complete pipeline topology before publishing schedulable callbacks', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const callbackSnapshots: string[][] = [];
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
    onCommitted: () => {
      callbackSnapshots.push(
        workstation.state.executions.byPipelineRunId('pipeline-b')
          .map((record) => record.lifecycle.phase),
      );
    },
  });
  const requests = ['a', 'b', 'c'].map((suffix, index) => request({
    requestId: `request-${suffix}`,
    executionId: `execution-${suffix}`,
    sessionId: `session-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-b',
    pipelineStepId: `step-${suffix}`,
    pipelineSkillRunId: `skill-${suffix}`,
    predecessorExecutionId: index === 0 ? null : `execution-${['a', 'b'][index - 1]}`,
  }));

  const receipts = await router.routeBatch(requests);
  const retried = await router.routeBatch(requests);

  assert.deepEqual(retried, receipts);
  assert.deepEqual(receipts.map((entry) => entry.phase), ['queued', 'queued', 'queued']);
  assert.equal(callbackSnapshots.length, 3);
  assert.deepEqual(callbackSnapshots[0], ['queued', 'queued', 'queued']);
  assert.deepEqual(callbackSnapshots.at(-1), ['queued', 'queued', 'queued']);
});

test('admits a dynamic pipeline whose declared external predecessor is the active caller', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  await router.route(request({
    requestId: 'request-gate',
    executionId: 'execution-gate',
    sessionId: 'session-gate',
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-gate',
    pipelineStepId: 'step-gate',
    pipelineSkillRunId: 'skill-gate',
  }));
  await workstation.state.executions.transition('execution-gate', { phase: 'starting' });
  await workstation.state.executions.transition('execution-gate', { phase: 'running' });
  const topology = ['work', 'gate'].map((suffix, index) => request({
    requestId: `request-dynamic-${suffix}`,
    executionId: `execution-dynamic-${suffix}`,
    sessionId: `session-dynamic-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-dynamic',
    pipelineStepId: `step-dynamic-${suffix}`,
    pipelineSkillRunId: `skill-dynamic-${suffix}`,
    predecessorExecutionId: index === 0 ? 'execution-gate' : 'execution-dynamic-work',
  }));
  const now = '2026-07-23T01:02:00.000Z';
  const run: CodexPipelineRun = {
    id: 'pipeline-dynamic',
    restartOfPipelineRunId: null,
    queuedAfterExecutionId: 'execution-gate',
    initialInputCardId: 'gate-output',
    pipelineId: null,
    pipelineName: 'Dynamic work then gate',
    temporary: true,
    executionMode: 'local',
    ledgerId: 'tasks',
    sourceCardId: 'child',
    sourceCardTitle: 'Child',
    outputParentCardId: 'master',
    status: 'pending',
    steps: topology.map((launch, index) => ({
      id: launch.pipelineStepId!,
      stepId: launch.pipelineStepId!,
      name: index === 0 ? 'Work' : 'Gate',
      purpose: '',
      outputCardId: `output-${index + 1}`,
      outputSubtaskPosition: index,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: '',
      skills: [{
        id: `run-skill-${index + 1}`,
        pipelineSkillId: launch.pipelineSkillRunId!,
        skillName: index === 0 ? 'analysis' : 'gate',
        contentKind: 'federated-skill',
        runId: launch.sessionId,
        executionId: launch.executionId,
        status: 'pending',
        codexModel: 'gpt-5.6-sol',
        codexEffort: 'medium',
        stdoutFile: `/tmp/${launch.sessionId}.jsonl`,
        stderrFile: `/tmp/${launch.sessionId}.log`,
        startedAt: null,
        finishedAt: null,
        error: '',
      }],
    })),
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    resumedAt: null,
    error: '',
  };

  const receipts = await router.routeBatch(topology, { pipelineRun: run });

  assert.deepEqual(receipts.map((receipt) => receipt.phase), ['queued', 'queued']);
  assert.equal(workstation.state.executions.find('execution-gate')?.lifecycle.phase, 'running');
  assert.equal(workstation.state.executions.find('execution-dynamic-work')?.metadata.predecessorExecutionId, 'execution-gate');
  await workstation.state.executions.transition('execution-gate', {
    phase: 'failed',
    error: { code: 'gate_failed', message: 'Gate failed.' },
  });
  await cancelPipelineDependents({
    runtime: { taskExecutionState: workstation.state },
    pipelineRunId: 'pipeline-gate',
    executionId: 'execution-gate',
  });
  assert.deepEqual(
    ['execution-dynamic-work', 'execution-dynamic-gate']
      .map((executionId) => workstation.state.executions.find(executionId)?.lifecycle.phase),
    ['cancelled', 'cancelled'],
  );
});

test('a failed queued-state commit publishes no direct Run scheduler callback', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const transition = workstation.state.executions.transition;
  workstation.state.executions.transition = async (...args: Parameters<typeof transition>) => {
    if (args[1].phase === 'queued') throw new Error('injected_queued_state_persistence_failure');
    return transition(...args);
  };
  let schedulerWakeCount = 0;
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
    onCommitted: () => {
      schedulerWakeCount += 1;
    },
  });

  await assert.rejects(router.route(request()), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError
    && error.message === 'injected_queued_state_persistence_failure'
  ));
  assert.equal(schedulerWakeCount, 0);
  assert.equal(workstation.state.executions.find('execution-a')?.lifecycle.phase, 'failed');
});

test('a partial Pipeline queue failure publishes no scheduler callback and leaves no queued execution', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const transition = workstation.state.executions.transition;
  workstation.state.executions.transition = async (...args: Parameters<typeof transition>) => {
    if (args[0] === 'execution-b' && args[1].phase === 'queued') {
      throw new Error('injected_pipeline_queue_persistence_failure');
    }
    return transition(...args);
  };
  let schedulerWakeCount = 0;
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
    onCommitted: () => {
      schedulerWakeCount += 1;
    },
  });
  const topology = ['a', 'b'].map((suffix, index) => request({
    requestId: `queue-failure-request-${suffix}`,
    executionId: `execution-${suffix}`,
    sessionId: `queue-failure-session-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-queue-failure',
    pipelineStepId: `step-${suffix}`,
    pipelineSkillRunId: `skill-${suffix}`,
    predecessorExecutionId: index === 0 ? null : 'execution-a',
  }));

  await assert.rejects(router.routeBatch(topology), (error: unknown) => (
    error instanceof TaskExecutionAdmissionError
    && error.message === 'injected_pipeline_queue_persistence_failure'
  ));
  assert.equal(schedulerWakeCount, 0);
  assert.deepEqual(
    workstation.state.executions.byPipelineRunId('pipeline-queue-failure').map((record) => record.lifecycle.phase),
    ['cancelled', 'failed'],
  );
});

test('rejects an invalid pipeline topology before admission and settles a post-admission policy rejection', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  const cyclic = ['a', 'b'].map((suffix, index) => request({
    requestId: `cycle-request-${suffix}`,
    executionId: `cycle-execution-${suffix}`,
    sessionId: `cycle-session-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-cycle',
    pipelineStepId: `step-${suffix}`,
    pipelineSkillRunId: `skill-${suffix}`,
    predecessorExecutionId: `cycle-execution-${index === 0 ? 'b' : 'a'}`,
  }));
  await assert.rejects(
    router.routeBatch(cyclic),
    (error: unknown) => error instanceof TaskExecutionAdmissionError && error.code === 'task_execution_topology_cycle',
  );
  assert.deepEqual(workstation.state.executions.byPipelineRunId('pipeline-cycle'), []);

  const rejectedFixture = fixture('workstation');
  context.after(() => dispose(rejectedFixture));
  const rejected = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => rejectedFixture.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
    validateLocal: ({ request: launch }) => {
      if (launch.executionId === 'execution-b') {
        throw new TaskExecutionAdmissionError('pipeline_policy_rejected', 409);
      }
    },
  });
  const topology = ['a', 'b'].map((suffix, index) => request({
    requestId: `request-${suffix}`,
    executionId: `execution-${suffix}`,
    sessionId: `session-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-rejected',
    pipelineStepId: `step-${suffix}`,
    pipelineSkillRunId: `skill-${suffix}`,
    predecessorExecutionId: index === 0 ? null : 'execution-a',
  }));
  await assert.rejects(
    rejected.routeBatch(topology),
    (error: unknown) => error instanceof TaskExecutionAdmissionError && error.code === 'pipeline_policy_rejected',
  );
  assert.deepEqual(
    rejectedFixture.state.executions.byPipelineRunId('pipeline-rejected').map((record) => record.lifecycle.phase),
    ['failed', 'failed'],
  );
});

test('serializes concurrent local admission so exactly one direct execution reaches the queue', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });

  const results = await Promise.allSettled([
    router.route(request()),
    router.route(request({ requestId: 'request-b', executionId: 'execution-b', sessionId: 'session-b' })),
  ]);

  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.ok(results[1].status === 'rejected' && results[1].reason instanceof TaskExecutionAdmissionError);
  assert.equal(results[1].status === 'rejected' ? results[1].reason.code : '', 'task_execution_active');
  assert.equal(workstation.state.executions.find('execution-a')?.lifecycle.phase, 'queued');
  assert.equal(workstation.state.executions.find('execution-b')?.lifecycle.phase, 'failed');
});

test('admits the master and distinct subtasks concurrently while preserving one active execution per source', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });

  const results = await Promise.all([
    router.route(request({
      requestId: 'request-master',
      executionId: 'execution-master',
      sessionId: 'session-master',
      sourceCardId: 'master',
      ownerCardId: 'master',
    })),
    router.route(request()),
    router.route(request({
      requestId: 'request-child-b',
      executionId: 'execution-child-b',
      sessionId: 'session-child-b',
      sourceCardId: 'child-b',
      ownerCardId: 'child-b',
    })),
  ]);

  assert.deepEqual(results.map((receipt) => receipt.taskId), ['master', 'master', 'master']);
  assert.deepEqual(results.map((receipt) => receipt.assignedNodeId), ['workstation', 'workstation', 'workstation']);
  assert.deepEqual(
    workstation.state.executions.byTaskId('master').map((record) => [
      record.metadata.sourceCardId,
      record.lifecycle.phase,
    ]),
    [['child', 'queued'], ['child-b', 'queued'], ['master', 'queued']],
  );
});

test('admits a pipeline batch while a sibling source is active', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  await router.route(request({
    requestId: 'request-child-b',
    executionId: 'execution-child-b',
    sessionId: 'session-child-b',
    sourceCardId: 'child-b',
    ownerCardId: 'child-b',
  }));
  const topology = ['a', 'b'].map((suffix, index) => request({
    requestId: `request-pipeline-${suffix}`,
    executionId: `execution-pipeline-${suffix}`,
    sessionId: `session-pipeline-${suffix}`,
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-child',
    pipelineStepId: `step-${suffix}`,
    pipelineSkillRunId: `skill-${suffix}`,
    predecessorExecutionId: index === 0 ? null : 'execution-pipeline-a',
  }));

  const receipts = await router.routeBatch(topology);

  assert.deepEqual(receipts.map((receipt) => receipt.phase), ['queued', 'queued']);
  assert.equal(workstation.state.executions.find('execution-child-b')?.lifecycle.phase, 'queued');
});

test('validates session ownership and configured executor capacity before queueing', async (context) => {
  const workstation = fixture('workstation');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 1,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  await router.route(request({ ledgerId: 'architecture', sourceCardId: 'card-a', ownerCardId: 'card-a' }));

  await assert.rejects(
    router.route(request({
      requestId: 'request-session-b',
      executionId: 'execution-session-b',
      ledgerId: 'architecture',
      sourceCardId: 'card-b',
      ownerCardId: 'card-b',
    })),
    (error: unknown) => error instanceof TaskExecutionAdmissionError && error.code === 'task_execution_session_active',
  );
  assert.equal(workstation.state.executions.find('execution-session-b')?.lifecycle.phase, 'failed');

  const capacityFixture = fixture('workstation');
  context.after(() => dispose(capacityFixture));
  const noCapacity = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => capacityFixture.state,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 0,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });
  await assert.rejects(
    noCapacity.route(request()),
    (error: unknown) => error instanceof TaskExecutionAdmissionError && error.code === 'task_execution_capacity_unavailable',
  );
  assert.equal(capacityFixture.state.executions.find('execution-a')?.lifecycle.phase, 'failed');
});

test('binds non-task execution to the current node without creating task assignment state', async (context) => {
  const workstation = fixture('workstation', 'phone');
  context.after(() => dispose(workstation));
  const router = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => workstation.state,
    localNodeId: () => 'workstation',
    peer: () => ({ online: true }),
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });

  const admitted = await router.route(request({ ledgerId: 'architecture', sourceCardId: 'card-a', ownerCardId: 'card-a' }));

  assert.equal(admitted.taskId, 'card-a');
  assert.equal(admitted.assignedNodeId, 'workstation');
  assert.equal(admitted.executorNodeId, 'workstation');
  assert.equal(workstation.state.store.entity('card', 'card-a'), null);

  await assert.rejects(
    router.route(request({
      requestId: 'request-b',
      executionId: 'execution-b',
      sessionId: 'session-b',
      ledgerId: 'architecture',
      sourceCardId: 'card-a',
      ownerCardId: 'card-a',
    })),
    (error: unknown) => error instanceof TaskExecutionAdmissionError && error.code === 'task_execution_active',
  );
});
