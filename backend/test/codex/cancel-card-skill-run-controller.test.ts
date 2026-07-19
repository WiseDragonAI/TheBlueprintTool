/**
 * WHAT: Covers cancellation through a durable Codex process identity.
 * WHY: A restarted server and a lost non-enumerable child handle must not leave a live run unstoppable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cancelCardSkillRunController } from '@backend/business/codex/controller/cancel-card-skill-run-controller.js';
import { readCardSkillRunController } from '@backend/business/codex/controller/read-card-skill-run-controller.js';
import {
  enqueueCodexThreadProcess,
  markCodexProcessQueueItemRunning,
  readCodexProcessQueue,
  recordCodexProcessQueueItemProcess,
} from '@backend/business/codex/helper/codex-process-queue.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';

test('cancels a live run through its PID and start identity when the runtime child handle is absent', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-persisted-cancel-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const runId = 'codex-skill-persisted-live';
  const executionId = 'execution-persisted-live';
  const cardId = 'card-a';
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: cardId, codexActiveRunId: runId, codexActiveExecutionId: executionId, codexThreadRunId: runId, executionStatus: 'running', executionRunId: runId }],
  }));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  const closed = once(child, 'close');
  enqueueCodexThreadProcess({
    decisionOsRoot,
    id: runId,
    createdAt: '2026-07-17T07:00:00.000Z',
    payload: { ledgerId: 'specs', threadId: `thread-${cardId}`, cardId, runId, executionId },
  });
  markCodexProcessQueueItemRunning(decisionOsRoot, runId);
  recordCodexProcessQueueItemProcess({
    decisionOsRoot,
    id: runId,
    processId: child.pid ?? 0,
    stdoutFile: join(decisionOsRoot, 'run.jsonl'),
    stderrFile: join(decisionOsRoot, 'run.log'),
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    codexSkillRuns: {
      [runId]: { id: runId, executionId, ledgerId: 'specs', outputCardId: cardId, status: 'running', adopted: true, pid: child.pid },
    },
  };

  try {
    const status = await readCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId, runId, since: 0 },
      runtime_state: runtime,
    });
    assert.equal(status.status, 'running');
    assert.equal(status.active, true);

    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId, runId, executionId },
      runtime_state: runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    assert.equal(result.cancellationRequested, true);
    await closed;
    assert.equal(readCodexProcessQueue(decisionOsRoot).length, 1);
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexActiveRunId, runId);
    assert.equal(ledger.cards[0].codexActiveExecutionId, executionId);
    assert.equal(ledger.cards[0].codexThreadRunId, runId);
  } finally {
    if (child.exitCode === null) {
      try {
        process.kill(process.platform === 'win32' ? child.pid ?? 0 : -(child.pid ?? 0), 'SIGKILL');
      } catch {
        // The expected cancellation already settled the process.
      }
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('cancels a pending pipeline skill from its source-card projection with exact execution ownership', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-source-cancel-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const runId = 'pipeline-skill-run';
  const executionId = 'pipeline-execution';
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
      cards: [
        { id: 'source', codexActiveRunId: runId, codexActiveExecutionId: executionId, codexQueuedPipelineRunId: 'pipeline-run' },
        { id: 'output', codexActiveRunId: runId, codexActiveExecutionId: executionId, codexPipelineRunId: 'pipeline-run' },
      ],
    }));
    writeCodexPipelineStore({
      decisionOsRoot,
      store: {
        version: 1,
        pipelines: [],
        steps: [],
        skillLibrary: [],
        activeWorkspaceRun: 'pipeline-run',
        runs: [{
          id: 'pipeline-run', pipelineId: 'pipeline-a', pipelineName: 'Pipeline A', temporary: false, executionMode: 'local',
          ledgerId: 'specs', sourceCardId: 'source', sourceCardTitle: 'Source', status: 'pending', createdAt: '2026-07-19T00:00:00.000Z',
          updatedAt: '2026-07-19T00:00:00.000Z', startedAt: null, finishedAt: null, resumedAt: null, error: '',
          steps: [{
            id: 'run-step', stepId: 'step-a', name: 'Step A', purpose: '', outputCardId: 'output', status: 'pending', startedAt: null, finishedAt: null, error: '',
            skills: [{
              id: 'run-skill', pipelineSkillId: 'skill-a', skillName: 'analysis', runId, executionId, status: 'pending',
              codexModel: 'gpt-5.6-sol', codexEffort: 'medium', stdoutFile: '', stderrFile: '', startedAt: null, finishedAt: null, error: '',
            }],
          }],
        }],
      },
    });

    const result = await cancelCardSkillRunController({
      action_payload: { ledgerId: 'specs', cardId: 'source', runId, executionId },
      runtime_state: { decisionOsRoot },
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 202);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.runs[0]?.status, 'cancelled');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
