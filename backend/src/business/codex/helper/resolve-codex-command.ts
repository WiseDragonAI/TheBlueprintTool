/**
 * WHAT: Resolves the Codex CLI command and arguments for a headless workspace run.
 * WHY: The server process may not inherit the operator's interactive shell PATH.
 */
import { accessSync, constants, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, resolve } from 'node:path';
import {
  codexEffortOptions,
  codexModelOptions,
  type CodexEffort,
  type CodexModel,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

type AnyRecord = Record<string, unknown>;

export { codexEffortOptions, codexModelOptions };

export type CodexCommand = {
  command: string;
  args: string[];
  model: string;
  effort: string;
};

export type ResolvedSkillRunOptions = {
  codexModel: string;
  codexEffort: string;
};

type CodexSelection = {
  command: string;
  model: string;
  effort: string;
};

function settingsRecord(runtime: AnyRecord): AnyRecord {
  return runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
    ? runtime.decisionOsSettings as AnyRecord
    : {};
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathCandidates(command: string, workspaceRoot: string): string[] {
  if (!command) return [];
  if (isAbsolute(command)) return [command];
  if (command.includes('/')) return [resolve(workspaceRoot, command)];
  return String(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));
}

function nvmCodexCandidates(): string[] {
  const versionsRoot = resolve(homedir(), '.nvm', 'versions', 'node');
  try {
    return readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((version) => resolve(versionsRoot, version, 'bin', 'codex'));
  } catch {
    return [];
  }
}

function defaultCodexCandidates(): string[] {
  return [
    resolve(dirname(process.execPath), 'codex'),
    ...nvmCodexCandidates(),
    resolve(homedir(), '.local', 'bin', 'codex'),
    '/usr/local/bin/codex',
    '/usr/bin/codex',
  ];
}

function resolveExecutable(command: string, workspaceRoot: string): string {
  for (const candidate of [...pathCandidates(command, workspaceRoot), ...defaultCodexCandidates()]) {
    if (isExecutable(candidate)) return candidate;
  }
  return command || 'codex';
}

function allowedValue(value: unknown, options: readonly string[]): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return options.includes(text) ? text : '';
}

function firstAllowed(values: unknown[], options: readonly string[], fallback: string): string {
  for (const value of values) {
    const allowed = allowedValue(value, options);
    if (allowed) return allowed;
  }
  return fallback;
}

function resolveCodexSelection(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown }): CodexSelection {
  const settings = settingsRecord(input.runtime);
  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
  const model = firstAllowed([input.codexModel, process.env.CODEX_MODEL, settings.codexModel, settings.CODEX_MODEL], codexModelOptions, 'gpt-5.6-sol');
  const effort = firstAllowed([input.codexEffort, process.env.CODEX_EFFORT, settings.codexEffort, settings.codexReasoningEffort, settings.CODEX_EFFORT], codexEffortOptions, 'high');
  return {
    command: resolveExecutable(configuredCommand, input.workspaceRoot),
    model,
    effort,
  };
}

export function isAllowedCodexModel(value: unknown): value is CodexModel {
  return Boolean(allowedValue(value, codexModelOptions));
}

export function isAllowedCodexEffort(value: unknown): value is CodexEffort {
  return Boolean(allowedValue(value, codexEffortOptions));
}

/**
 * Resolves the immutable model and effort snapshot stored on one pipeline skill run.
 * Explicit run or step values win over the skill-library defaults; the ordinary
 * workspace/environment/built-in command selection remains the final fallback.
 */
export function resolveSkillRunOptions(input: {
  workspaceRoot: string;
  runtime: AnyRecord;
  explicitCodexModel?: unknown;
  explicitCodexEffort?: unknown;
  defaultCodexModel?: unknown;
  defaultCodexEffort?: unknown;
}): ResolvedSkillRunOptions {
  if (input.explicitCodexModel !== null && input.explicitCodexModel !== undefined && !isAllowedCodexModel(input.explicitCodexModel)) {
    throw new RangeError('Unsupported explicit Codex model.');
  }
  if (input.explicitCodexEffort !== null && input.explicitCodexEffort !== undefined && !isAllowedCodexEffort(input.explicitCodexEffort)) {
    throw new RangeError('Unsupported explicit Codex effort.');
  }
  if (input.defaultCodexModel !== null && input.defaultCodexModel !== undefined && !isAllowedCodexModel(input.defaultCodexModel)) {
    throw new RangeError('Unsupported skill-library Codex model.');
  }
  if (input.defaultCodexEffort !== null && input.defaultCodexEffort !== undefined && !isAllowedCodexEffort(input.defaultCodexEffort)) {
    throw new RangeError('Unsupported skill-library Codex effort.');
  }
  const command = resolveCodexCommand({
    workspaceRoot: input.workspaceRoot,
    runtime: input.runtime,
    codexModel: input.explicitCodexModel ?? input.defaultCodexModel,
    codexEffort: input.explicitCodexEffort ?? input.defaultCodexEffort,
  });
  return { codexModel: command.model, codexEffort: command.effort };
}

export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown; developerInstructions?: string }): CodexCommand {
  const selection = resolveCodexSelection(input);
  const developerInstructionArgs = input.developerInstructions === undefined
    ? []
    : ['-c', `developer_instructions=${JSON.stringify(input.developerInstructions)}`];
  return {
    command: selection.command,
    args: [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--json',
      '-C',
      input.workspaceRoot,
      '-c',
      `model_reasoning_effort="${selection.effort}"`,
      ...developerInstructionArgs,
      '--model',
      selection.model,
      '-',
    ],
    model: selection.model,
    effort: selection.effort,
  };
}

export function resolveCodexResumeCommand(input: { workspaceRoot: string; runtime: AnyRecord; sessionId: string; codexModel?: unknown; codexEffort?: unknown }): CodexCommand {
  const selection = resolveCodexSelection(input);
  return {
    command: selection.command,
    args: [
      'exec',
      'resume',
      '--dangerously-bypass-approvals-and-sandbox',
      '--json',
      '-c',
      `model_reasoning_effort="${selection.effort}"`,
      '--model',
      selection.model,
      input.sessionId,
      '-',
    ],
    model: selection.model,
    effort: selection.effort,
  };
}
