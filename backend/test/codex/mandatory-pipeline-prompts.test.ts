/**
 * WHAT: Proves mandatory pipeline prompts are restored into the server-owned Decision OS root.
 * WHY: Core execution prompts must survive project-local prompt removal and fresh server roots.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import {
  ensureMandatoryPipelinePrompts,
  mandatoryPipelinePromptNames,
} from '@backend/business/codex/helper/mandatory-pipeline-prompts.js';
import { ensureDecisionOsGitRepository } from '@backend/business/server/helper/ensure-decision-os-git-repository.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function createServerRoot(prefix: string): string {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(decisionOsRoot, 'pipeline-prompts'), { recursive: true });
  ensureDecisionOsGitRepository(decisionOsRoot);
  return decisionOsRoot;
}

test('installs, registers, commits, and then preserves every mandatory server prompt', () => {
  const decisionOsRoot = createServerRoot('decision-os-mandatory-prompts-');
  try {
    const installed = ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: decisionOsRoot });
    assert.deepEqual(installed.createdPromptIds, mandatoryPipelinePromptNames);
    assert.deepEqual(installed.registeredPromptIds, mandatoryPipelinePromptNames);

    const store = readCodexPipelineStore({ decisionOsRoot }).store;
    assert.deepEqual(
      store.authoredContent
        .filter((record) => mandatoryPipelinePromptNames.includes(record.id as typeof mandatoryPipelinePromptNames[number]))
        .map((record) => record.id),
      mandatoryPipelinePromptNames,
    );
    assert.deepEqual(
      store.skillLibrary
        .filter((record) => mandatoryPipelinePromptNames.includes(record.skillName as typeof mandatoryPipelinePromptNames[number]))
        .map((record) => [record.skillName, record.tags]),
      mandatoryPipelinePromptNames.map((name) => [name, ['System']]),
    );
    assert.match(
      readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md'), 'utf8'),
      /one to 30 repeated `--card-id` flags/,
    );
    assert.match(
      readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md'), 'utf8'),
      /ledger-cli prompt query --name <prompt-name> \[--name <prompt-name>\]\.\.\./,
    );
    assert.match(
      readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md'), 'utf8'),
      /tools\/map\.mjs c \[base-directory\] \[depth\]/,
    );
    assert.doesNotMatch(
      readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md'), 'utf8'),
      /Queue exactly one skill after the current gate execution/,
    );
    assert.match(
      readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CODEX_RUN.md'), 'utf8'),
      /\{\{SYSTEM_PROMPT\}\}/,
    );
    assert.equal(git(decisionOsRoot, ['status', '--short']), '');
    const commitMessage = git(decisionOsRoot, ['show', '-s', '--format=%B', 'HEAD']);
    assert.match(commitMessage, /^Install mandatory pipeline prompts/);
    assert.match(commitMessage, /WHAT: Restore missing server-owned mandatory prompt files and registrations\./);
    assert.match(commitMessage, /WHY: Decision OS execution must not depend on project-local prompt copies\./);

    const head = git(decisionOsRoot, ['rev-parse', 'HEAD']);
    const cliToolsBytes = readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md'));
    assert.deepEqual(
      ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: decisionOsRoot }),
      { createdPromptIds: [], registeredPromptIds: [] },
    );
    assert.equal(git(decisionOsRoot, ['rev-parse', 'HEAD']), head);
    assert.deepEqual(readFileSync(join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md')), cliToolsBytes);
  } finally {
    rmSync(decisionOsRoot, { recursive: true, force: true });
  }
});

test('preserves invalid existing mandatory prompt bytes', () => {
  const decisionOsRoot = createServerRoot('decision-os-invalid-mandatory-prompt-');
  try {
    ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: decisionOsRoot });
    const cliToolsFile = join(decisionOsRoot, 'pipeline-prompts', 'CLI_TOOLS.md');
    writeFileSync(cliToolsFile, Buffer.from([0xff, 0xfe, 0xfd]));
    const registrationBytes = readFileSync(join(decisionOsRoot, 'codex-pipelines.json'));

    assert.throws(
      () => ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: decisionOsRoot }),
      /CLI_TOOLS is not valid UTF-8/,
    );
    assert.deepEqual(readFileSync(cliToolsFile), Buffer.from([0xff, 0xfe, 0xfd]));
    assert.deepEqual(readFileSync(join(decisionOsRoot, 'codex-pipelines.json')), registrationBytes);
  } finally {
    rmSync(decisionOsRoot, { recursive: true, force: true });
  }
});
