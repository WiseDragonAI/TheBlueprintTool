/**
 * WHAT: Covers bounded direct federation message execution.
 * WHY: A stuck Codex child must settle durably instead of retaining a capacity slot forever.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { executeNodeMessage } from '@backend/business/federation/helper/execute-node-message.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';
import { createCodexCapacitySlots } from '@backend/business/codex/helper/codex-capacity-slots.js';

test('direct node message execution times out, terminates, and persists a failed manifest', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-node-message-timeout-'));
  const decisionOsRoot = resolve(root, '.decision-os');
  const fakeCodex = resolve(root, 'fake-codex.mjs');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));
  writeFileSync(fakeCodex, '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n');
  chmodSync(fakeCodex, 0o755);
  const project: DecisionOsProject = {
    id: 'project-a',
    name: 'Project A',
    relativePath: '.',
    root,
    decisionOsRoot,
    description: '',
    color: '#38d9e8',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    available: true,
    diagnostic: '',
  };

  try {
    await assert.rejects(executeNodeMessage({
      project,
      runtime: { codexExecutionTimeoutMs: 25, decisionOsSettings: { codexBin: fakeCodex } },
      requesterNodeId: 'workstation',
      executorNodeId: 'phone',
      executorNodeLabel: 'Phone',
      message: 'Report the current state.',
    }), /exceeded 25ms/);
    const runDirectory = resolve(decisionOsRoot, 'runs', 'node-messages');
    const manifestFile = readdirSync(runDirectory).find((name) => name.endsWith('.json') && !name.endsWith('.jsonl'));
    assert.ok(manifestFile);
    const manifest = JSON.parse(readFileSync(resolve(runDirectory, manifestFile), 'utf8')) as { status: string; error: string };
    assert.equal(manifest.status, 'failed');
    assert.match(manifest.error, /exceeded 25ms/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shared capacity queues node messages behind task work and never oversubscribes direct children', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-node-message-capacity-'));
  const decisionOsRoot = resolve(root, '.decision-os');
  const fakeCodex = resolve(root, 'fake-codex.mjs');
  const startsFile = resolve(root, 'starts.log');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync } from "node:fs";',
    `appendFileSync(${JSON.stringify(startsFile)}, String(process.pid) + "\\n");`,
    'setTimeout(() => {',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "capacity-thread" }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "answer", type: "agent_message", text: "done" } }));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '}, 100);',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const project: DecisionOsProject = {
    id: 'project-a',
    name: 'Project A',
    relativePath: '.',
    root,
    decisionOsRoot,
    description: '',
    color: '#38d9e8',
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    available: true,
    diagnostic: '',
  };
  let taskProcesses = 1;
  const slots = createCodexCapacitySlots({
    capacity: () => 1,
    externalRunningCount: () => taskProcesses,
    pollIntervalMs: 5,
  });
  const runtime = {
    decisionOsSettings: { codexBin: fakeCodex },
    acquireProjectSyncCodexSlot: slots.acquire,
  };
  const execute = (signal?: AbortSignal) => executeNodeMessage({
    project,
    runtime,
    requesterNodeId: 'workstation',
    executorNodeId: 'phone',
    executorNodeLabel: 'Phone',
    message: 'Report the current state.',
    signal,
  });

  try {
    const blocked = new AbortController();
    const blockedExecution = execute(blocked.signal);
    setTimeout(() => blocked.abort(), 25);
    await assert.rejects(blockedExecution, /cancelled/);
    assert.equal(existsSync(startsFile), false);

    taskProcesses = 0;
    const first = execute();
    const second = execute();
    const firstStartDeadline = Date.now() + 2_000;
    while ((!existsSync(startsFile) || readFileSync(startsFile, 'utf8').trim().split('\n').length < 1)
      && Date.now() < firstStartDeadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    }
    assert.equal(existsSync(startsFile), true);
    assert.equal(readFileSync(startsFile, 'utf8').trim().split('\n').length, 1);
    await Promise.all([first, second]);
    assert.equal(readFileSync(startsFile, 'utf8').trim().split('\n').length, 2);
    assert.equal(slots.reservedCount(), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
