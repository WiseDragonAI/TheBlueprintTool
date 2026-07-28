/**
 * WHAT: Verifies canonical Codex launch uses direct files instead of HTTP-server-owned pipes.
 * WHY: Replacing the server must not close a running Codex process's standard streams.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchCodexExecutionProcess, type CodexProcessSettlement } from '@backend/business/codex/helper/launch-codex-execution-process.js';

test('launch binds Codex stdio directly to durable files', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-direct-codex-stdio-'));
  context.after(() => rmSync(workspace, { recursive: true, force: true }));
  const ledgerPath = join(workspace, 'tasks.json');
  const stdoutFile = join(workspace, 'run.jsonl');
  const stderrFile = join(workspace, 'run.stderr.log');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  let resolveSettlement!: (settlement: CodexProcessSettlement) => void;
  const settlementPromise = new Promise<CodexProcessSettlement>((resolve) => { resolveSettlement = resolve; });

  const launched = await launchCodexExecutionProcess({
    decisionOsRoot: workspace,
    runtime: { codexExecutionTimeoutMs: 5_000 },
    workspaceRoot: workspace,
    ledgerId: 'tasks',
    ledgerPath,
    cardId: 'task-a',
    runId: 'run-a',
    executionId: 'execution-a',
    command: {
      command: process.execPath,
      args: ['-e', "process.stdin.setEncoding('utf8');let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{process.stdout.write(input);process.stderr.write('stderr-direct\\n')})"],
      model: '',
      effort: '',
    },
    env: process.env,
    prompt: 'prompt-through-file\n',
    stdoutFile,
    stderrFile,
    segment: 'start',
    startLine: 0,
    onSpawn: (child) => {
      assert.equal(child.stdin, null);
      assert.equal(child.stdout, null);
      assert.equal(child.stderr, null);
    },
    onSettled: resolveSettlement,
  });
  const settlement = await settlementPromise;

  assert.equal(settlement.kind, 'close');
  assert.equal(settlement.exitCode, 0);
  assert.equal(readFileSync(stdoutFile, 'utf8'), 'prompt-through-file\n');
  assert.match(readFileSync(stderrFile, 'utf8'), /stderr-direct/);
  assert.equal(existsSync(`${stderrFile}.execution-a.stdin`), false);
  assert.ok(launched.child.pid);
});
