/**
 * WHAT: Covers bounded direct federation message execution.
 * WHY: A stuck Codex child must settle durably instead of retaining a capacity slot forever.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { executeNodeMessage } from '@backend/business/federation/helper/execute-node-message.js';
import type { DecisionOsProject } from '@backend/business/server/helper/project-catalog.js';

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
