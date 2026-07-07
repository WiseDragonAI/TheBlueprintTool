import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { resolveCodexCommand } from '@backend/business/codex/helper/resolve-codex-command.js';

test('resolveCodexCommand honors an explicit executable setting', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
  const bin = join(workspace, 'codex-bin');
  const previousCodexBin = process.env.CODEX_BIN;
  const previousCodexModel = process.env.CODEX_MODEL;
  const previousCodexEffort = process.env.CODEX_EFFORT;
  try {
    delete process.env.CODEX_BIN;
    delete process.env.CODEX_MODEL;
    delete process.env.CODEX_EFFORT;
    writeFileSync(bin, '#!/bin/sh\nexit 0\n');
    chmodSync(bin, 0o755);
    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'test-model', codexReasoningEffort: 'low' } } });

    assert.equal(command.command, bin);
    assert.deepEqual(command.args.slice(0, 5), ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', '-C', workspace]);
    assert.equal(command.args.includes('test-model'), true);
    assert.equal(command.args.includes('model_reasoning_effort="low"'), true);
  } finally {
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    if (previousCodexModel === undefined) delete process.env.CODEX_MODEL;
    else process.env.CODEX_MODEL = previousCodexModel;
    if (previousCodexEffort === undefined) delete process.env.CODEX_EFFORT;
    else process.env.CODEX_EFFORT = previousCodexEffort;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('resolveCodexCommand can find Codex beside the running Node executable when PATH is sparse', () => {
  const adjacentCodex = resolve(dirname(process.execPath), 'codex');
  if (!existsSync(adjacentCodex)) return;
  const previousPath = process.env.PATH;
  const previousCodexBin = process.env.CODEX_BIN;
  try {
    process.env.PATH = '/usr/bin';
    delete process.env.CODEX_BIN;
    const command = resolveCodexCommand({ workspaceRoot: process.cwd(), runtime: {} });
    assert.equal(command.command, adjacentCodex);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
  }
});
