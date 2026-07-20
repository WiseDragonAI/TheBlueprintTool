/**
 * WHAT: Covers adoption of a durable live pipeline child after runtime memory is lost.
 * WHY: Restart recovery must retain the exact execution and process identity instead of launching a duplicate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexProcessIdentity } from '@backend/business/codex/helper/codex-process-queue.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { resumeCodexPipelineRuns } from '@backend/business/codex/helper/resume-codex-pipeline-runs.js';

test('restart recovery adopts a live pipeline process with its exact execution identity', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-adoption-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' });
  const closed = once(child, 'close');
  const processId = child.pid ?? 0;
  const processStartTime = codexProcessIdentity(processId);
  const runtime: Record<string, any> = {
    decisionOsRoot,
    scheduleCodexProcesses: async () => ({ ok: true, launched: [] }),
  };
  try {
    assert.ok(processId > 0);
    assert.ok(processStartTime);
    writeCodexPipelineStore({
      decisionOsRoot,
      store: {
        version: 1,
        pipelines: [],
        steps: [],
        skillLibrary: [],
        activeWorkspaceRun: 'pipeline-adopted',
        runs: [{
          id: 'pipeline-adopted', pipelineId: 'pipeline-a', pipelineName: 'Pipeline A', temporary: false, executionMode: 'local',
          ledgerId: 'specs', sourceCardId: 'source', sourceCardTitle: 'Source', status: 'running', createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z', startedAt: '2026-07-20T00:00:00.000Z', finishedAt: null, resumedAt: null, error: '',
          steps: [{
            id: 'run-step', stepId: 'step-a', name: 'Step A', purpose: '', outputCardId: 'output', status: 'running', startedAt: '2026-07-20T00:00:00.000Z', finishedAt: null, error: '',
            skills: [{
              id: 'run-skill', pipelineSkillId: 'skill-a', skillName: 'analysis', runId: 'skill-adopted', executionId: 'execution-adopted', status: 'running',
              codexModel: 'gpt-5.6-sol', codexEffort: 'medium', stdoutFile: join(decisionOsRoot, 'run.jsonl'), stderrFile: join(decisionOsRoot, 'run.log'),
              processId, processStartTime, startedAt: '2026-07-20T00:00:00.000Z', finishedAt: null, error: '',
            }],
          }],
        }],
      },
    });

    const result = await resumeCodexPipelineRuns({ decisionOsRoot, runtime });
    assert.deepEqual(result.resumed, [{ pipelineRunId: 'pipeline-adopted', runId: 'skill-adopted', executionId: 'execution-adopted', adopted: true }]);
    assert.equal(runtime.codexSkillRuns['skill-adopted'].executionId, 'execution-adopted');
    assert.equal(runtime.codexSkillRuns['skill-adopted'].pid, processId);
    assert.equal(runtime.codexSkillRuns['skill-adopted'].processStartTime, processStartTime);
    assert.equal(runtime.codexSkillRuns['skill-adopted'].adopted, true);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.runs[0]?.status, 'running');
    runtime.codexSkillRuns['skill-adopted'].status = 'complete';
  } finally {
    if (child.exitCode === null) {
      try { process.kill(process.platform === 'win32' ? processId : -processId, 'SIGKILL'); } catch { /* already exited */ }
      await closed;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});
