import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  decisionOsRuntimePlatform,
  resolveCodexCommand,
  resolveCodexResumeCommand,
  resolveSkillRunOptions,
} from '@backend/business/codex/helper/resolve-codex-command.js';

function decodedDeveloperInstructions(args: string[]): string {
  const encoded = args.find((argument) => argument.startsWith('developer_instructions='));
  assert.ok(encoded);
  return JSON.parse(encoded.slice('developer_instructions='.length));
}

test('decisionOsRuntimePlatform maps supported Node hosts to the injected platform contract', () => {
  assert.equal(decisionOsRuntimePlatform('linux'), 'linux');
  assert.equal(decisionOsRuntimePlatform('android'), 'termux');
  assert.throws(() => decisionOsRuntimePlatform('darwin'), /Unsupported Decision OS runtime platform/);
});

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
    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } } });

    assert.equal(command.command, bin);
    assert.deepEqual(command.args.slice(0, 5), ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', '-C', workspace]);
    assert.equal(command.args.includes('gpt-5.4'), true);
    assert.equal(command.args.includes('model_reasoning_effort="low"'), true);
    assert.equal(decodedDeveloperInstructions(command.args), 'platform: linux');
    assert.equal(command.args.filter((argument) => argument.startsWith('developer_instructions=')).length, 1);

    const developerInstructions = 'Line one\n"quoted" and C:\\workspace\\card';
    const scopedCommand = resolveCodexCommand({
      workspaceRoot: workspace,
      runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } },
      developerInstructions,
    });
    assert.equal(decodedDeveloperInstructions(scopedCommand.args), `platform: linux\n${developerInstructions}`);
    assert.equal(scopedCommand.args.filter((argument) => argument.startsWith('developer_instructions=')).length, 1);
    assert.equal(scopedCommand.args.filter((argument) => argument === '-c').length, 2);
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

test('resolveCodexCommand lets run payload override settings model and effort', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
  try {
    const command = resolveCodexCommand({
      workspaceRoot: workspace,
      runtime: { decisionOsSettings: { codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } },
      codexModel: 'gpt-5.5',
      codexEffort: 'xhigh'
    });

    assert.equal(command.model, 'gpt-5.5');
    assert.equal(command.effort, 'xhigh');
    assert.equal(command.args.includes('gpt-5.5'), true);
    assert.equal(command.args.includes('model_reasoning_effort="xhigh"'), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('resolveCodexCommand supports GPT-5.6 with ultra reasoning', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
  try {
    const command = resolveCodexCommand({
      workspaceRoot: workspace,
      runtime: {},
      codexModel: 'gpt-5.6-sol',
      codexEffort: 'ultra'
    });

    assert.equal(command.model, 'gpt-5.6-sol');
    assert.equal(command.effort, 'ultra');
    assert.equal(command.args.includes('gpt-5.6-sol'), true);
    assert.equal(command.args.includes('model_reasoning_effort="ultra"'), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('resolveCodexCommand defaults to gpt-5.6-sol with medium effort when no selection is configured', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
  const previousCodexModel = process.env.CODEX_MODEL;
  const previousCodexEffort = process.env.CODEX_EFFORT;
  try {
    delete process.env.CODEX_MODEL;
    delete process.env.CODEX_EFFORT;
    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: {} });

    assert.equal(command.model, 'gpt-5.6-sol');
    assert.equal(command.effort, 'medium');
    assert.equal(command.args.includes('gpt-5.6-sol'), true);
    assert.equal(command.args.includes('model_reasoning_effort="medium"'), true);
    assert.equal(decodedDeveloperInstructions(command.args), 'platform: linux');
    assert.equal(command.args.filter((argument) => argument.startsWith('developer_instructions=')).length, 1);
  } finally {
    if (previousCodexModel === undefined) delete process.env.CODEX_MODEL;
    else process.env.CODEX_MODEL = previousCodexModel;
    if (previousCodexEffort === undefined) delete process.env.CODEX_EFFORT;
    else process.env.CODEX_EFFORT = previousCodexEffort;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('resolveCodexResumeCommand builds an exec resume invocation with stdin prompt', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-resume-command-'));
  try {
    const command = resolveCodexResumeCommand({
      workspaceRoot: workspace,
      runtime: { decisionOsSettings: { codexModel: 'gpt-5.4', codexReasoningEffort: 'medium' } },
      sessionId: '019f3c6d-38a5-7e23-a238-904176322f0c'
    });

    assert.deepEqual(command.args.slice(0, 4), ['exec', 'resume', '--dangerously-bypass-approvals-and-sandbox', '--json']);
    assert.equal(command.args.includes('019f3c6d-38a5-7e23-a238-904176322f0c'), true);
    assert.equal(command.args.at(-1), '-');
    assert.equal(command.args.includes('gpt-5.4'), true);
    assert.equal(command.args.includes('model_reasoning_effort="medium"'), true);
  } finally {
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

test('resolveSkillRunOptions applies explicit, library-default, and fallback precedence', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-options-'));
  try {
    assert.deepEqual(resolveSkillRunOptions({
      workspaceRoot: workspace,
      runtime: { decisionOsSettings: { codexModel: 'gpt-5.2', codexReasoningEffort: 'medium' } },
      defaultCodexModel: 'gpt-5.4',
      defaultCodexEffort: 'high',
    }), { codexModel: 'gpt-5.4', codexEffort: 'high' });
    assert.deepEqual(resolveSkillRunOptions({
      workspaceRoot: workspace,
      runtime: { decisionOsSettings: { codexModel: 'gpt-5.2', codexReasoningEffort: 'medium' } },
      explicitCodexModel: 'gpt-5.6-sol',
      explicitCodexEffort: 'ultra',
      defaultCodexModel: 'gpt-5.4',
      defaultCodexEffort: 'high',
    }), { codexModel: 'gpt-5.6-sol', codexEffort: 'ultra' });
    assert.throws(() => resolveSkillRunOptions({
      workspaceRoot: workspace,
      runtime: {},
      defaultCodexModel: 'unsupported',
    }), /Unsupported skill-library Codex model/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
