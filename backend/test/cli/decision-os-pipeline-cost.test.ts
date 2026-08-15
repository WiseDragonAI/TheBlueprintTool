import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  buildPipelineCostReport,
  formatPipelineCostReport,
} from '../../../bin/decision-os-pipeline-cost.mjs';

const execFileAsync = promisify(execFile);

function writeRun(file: string, usage: Record<string, number> | null): void {
  const rows: unknown[] = [{ type: 'thread.started' }];
  // WHAT: Add a terminal receipt only for completed fixture runs.
  // WHY: The report must distinguish priced completion from interrupted execution.
  if (usage) rows.push({ type: 'turn.completed', usage });
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

test('pipeline cost report aggregates priced runs, real overlapping time, and missing receipts', () => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-pipeline-cost-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const runsRoot = resolve(decisionOsRoot, 'runs', 'codex-skills', 'tasks');
  mkdirSync(runsRoot, { recursive: true });
  const solRun = resolve(runsRoot, 'sol-run.jsonl');
  const terraRun = resolve(runsRoot, 'terra-run.jsonl');
  const interruptedRun = resolve(runsRoot, 'interrupted-run.jsonl');
  writeRun(solRun, {
    input_tokens: 1_000_000,
    cached_input_tokens: 800_000,
    cache_write_input_tokens: 10_000,
    output_tokens: 20_000,
    reasoning_output_tokens: 5_000,
  });
  writeRun(terraRun, {
    input_tokens: 500_000,
    cached_input_tokens: 300_000,
    cache_write_input_tokens: 0,
    output_tokens: 10_000,
    reasoning_output_tokens: 2_000,
  });
  writeRun(interruptedRun, null);
  writeFileSync(resolve(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
    version: 2,
    runs: [{
      id: 'pipeline-run-1',
      pipelineName: 'Measured pipeline',
      ledgerId: 'tasks',
      sourceCardId: 'card-1',
      steps: [{
        id: 'step-run-1',
        stepId: 'step-1',
        name: 'Implementation',
        skills: [
          {
            runId: 'sol-run', executionId: 'execution-sol', skillName: 'GateAgent', codexModel: 'gpt-5.6-sol', codexEffort: 'high', stdoutFile: solRun,
            startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:10:00.000Z', status: 'complete',
          },
          {
            runId: 'terra-run', executionId: 'execution-terra', skillName: 'Coder', codexModel: 'gpt-5.6-terra', codexEffort: 'high', stdoutFile: terraRun,
            startedAt: '2026-01-01T00:05:00.000Z', finishedAt: '2026-01-01T00:15:00.000Z', status: 'complete',
          },
          {
            runId: 'interrupted-run', executionId: 'execution-interrupted', skillName: 'Verifier', codexModel: 'gpt-5.6-sol', codexEffort: 'high', stdoutFile: interruptedRun,
            startedAt: '2026-01-01T01:00:00.000Z', finishedAt: '2026-01-01T01:05:00.000Z', status: 'failed',
          },
        ],
      }],
    }],
  }), 'utf8');

  const report = buildPipelineCostReport({ decisionOsRoot: workspace, cardId: 'card-1' });
  assert.equal(report.summary.pipelineRunCount, 1);
  assert.equal(report.summary.stepCount, 1);
  assert.equal(report.summary.runCount, 3);
  assert.equal(report.summary.activeDurationMs, 20 * 60 * 1_000);
  assert.equal(report.summary.usageReceiptCount, 2);
  assert.equal(report.summary.missingUsageRunCount, 1);
  assert.equal(report.summary.costComplete, false);
  assert.equal(report.summary.cachedInputTokens, 1_100_000);
  assert.equal(report.summary.nonCachedInputTokens, 400_000);
  assert.equal(report.summary.outputTokens, 30_000);
  assert.ok(Math.abs(report.summary.recordedCostUsd - 2.6425) < 0.000_001);
  assert.equal(report.pipelines[0]?.steps[0]?.runs[2]?.usageError, 'usage_receipt_missing');

  const output = formatPipelineCostReport(report);
  assert.match(output, /STEP step-run-1 .*active=0h 20m 00s recorded_cost=\$2\.6425 cost_complete=false/);
  assert.match(output, /RUN interrupted-run .*cost=unavailable .*usage=usage_receipt_missing/);
  assert.match(output, /SUMMARY pipelines=1 steps=1 runs=3 active=0h 20m 00s .*cost_complete=false/);
});

test('pipeline cost CLI exposes its report selectors without workspace state', async () => {
  const cli = resolve(process.cwd(), '..', 'bin', 'decision-os-pipeline-cost.mjs');
  const result = await execFileAsync(process.execPath, [cli, '--help']);
  assert.match(result.stdout, /--card-id <id>/);
  assert.match(result.stdout, /--pipeline-run-id <id>/);
  assert.match(result.stdout, /--codex-run-id <id>/);
});

test('pipeline cost report filters one Codex execution identity', () => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-pipeline-cost-filter-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const runsRoot = resolve(decisionOsRoot, 'runs', 'codex-skills', 'tasks');
  mkdirSync(runsRoot, { recursive: true });
  const runFile = resolve(runsRoot, 'selected.jsonl');
  writeRun(runFile, { input_tokens: 100, cached_input_tokens: 50, output_tokens: 10 });
  writeFileSync(resolve(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
    version: 2,
    runs: [{
      id: 'pipeline-run-filter', pipelineName: 'Filter', ledgerId: 'tasks', sourceCardId: 'card-filter',
      steps: [{ id: 'step-filter', stepId: 'step', name: 'Only', skills: [{
        runId: 'selected', executionId: 'execution-selected', skillName: 'analysis', codexModel: 'gpt-5.6-sol', stdoutFile: runFile,
        startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:01.000Z',
      }] }],
    }],
  }), 'utf8');

  const selected = buildPipelineCostReport({ decisionOsRoot, codexRunId: 'execution-selected' });
  const absent = buildPipelineCostReport({ decisionOsRoot, codexRunId: 'execution-absent' });
  assert.equal(selected.summary.runCount, 1);
  assert.equal(absent.summary.runCount, 0);
});
