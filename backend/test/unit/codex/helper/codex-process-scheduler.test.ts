/**
 * WHAT: Proves the permanent scheduler poll reads pipeline state only for queued pipeline work.
 * WHY: Idle, thread, and continuation queues must not reread multi-megabyte pipeline stores every second.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  nextPendingCodexProcessCreatedAt,
  pendingCodexProcessEntries,
} from '../../../../src/business/codex/helper/codex-process-scheduler.js';
import { RuntimeScopePausedError } from '../../../../src/business/server/helper/runtime-incident-ledger.js';

type Execution = {
  metadata: {
    executionId: string;
    requestedAt: string;
    kind: 'thread' | 'continuation' | 'pipeline-skill';
    pipelineRunId: string | null;
    predecessorExecutionId: string | null;
  };
  lifecycle: { executorNodeId: string; phase: string };
};

function execution(kind: Execution['metadata']['kind'], executionId: string, requestedAt: string): Execution {
  return {
    metadata: {
      executionId,
      requestedAt,
      kind,
      pipelineRunId: kind === 'pipeline-skill' ? 'run-a' : null,
      predecessorExecutionId: null,
    },
    lifecycle: { executorNodeId: 'workstation', phase: 'queued' },
  };
}

test('scheduler ticks bypass the pipeline store until pipeline work is queued', (context) => {
  const decisionOsRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-idle-scheduler-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'codex-pipelines.json'), '{"version":1,"pipelines":[');

  let queued: Execution[] = [];
  const runtime = {
    taskExecutionNodeId: 'workstation',
    taskExecutionState: {
      executions: {
        byPhase: () => queued,
        find: (executionId: string) => queued.find((record) => record.metadata.executionId === executionId) ?? null,
      },
    },
  };

  assert.equal(nextPendingCodexProcessCreatedAt(decisionOsRoot, runtime as never), null);
  assert.deepEqual(pendingCodexProcessEntries(decisionOsRoot, runtime as never), []);

  queued = [execution('thread', 'thread-a', '2026-08-16T00:00:00.000Z')];
  assert.equal(nextPendingCodexProcessCreatedAt(decisionOsRoot, runtime as never), '2026-08-16T00:00:00.000Z');
  assert.deepEqual(pendingCodexProcessEntries(decisionOsRoot, runtime as never), [{
    id: 'thread-a',
    createdAt: '2026-08-16T00:00:00.000Z',
    order: 0,
  }]);

  queued = [execution('continuation', 'continuation-a', '2026-08-16T00:01:00.000Z')];
  assert.equal(nextPendingCodexProcessCreatedAt(decisionOsRoot, runtime as never), '2026-08-16T00:01:00.000Z');

  queued = [execution('pipeline-skill', 'pipeline-a', '2026-08-16T00:02:00.000Z')];
  assert.throws(
    () => nextPendingCodexProcessCreatedAt(decisionOsRoot, runtime as never),
    (error: unknown) => error instanceof RuntimeScopePausedError
      && error.issueCodes.includes('invalid-store'),
  );
});
