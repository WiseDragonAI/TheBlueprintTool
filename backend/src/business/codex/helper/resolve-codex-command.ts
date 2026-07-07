/**
 * WHAT: Resolves the Codex CLI command and arguments for a headless workspace run.
 * WHY: The server process may not inherit the operator's interactive shell PATH.
 */
import { accessSync, constants, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;

export type CodexCommand = {
  command: string;
  args: string[];
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

export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord }): CodexCommand {
  const settings = settingsRecord(input.runtime);
  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
  const model = String(process.env.CODEX_MODEL || settings.codexModel || settings.CODEX_MODEL || 'gpt-5.5');
  const effort = String(process.env.CODEX_EFFORT || settings.codexReasoningEffort || settings.CODEX_EFFORT || 'high');
  return {
    command: resolveExecutable(configuredCommand, input.workspaceRoot),
    args: [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--json',
      '-C',
      input.workspaceRoot,
      '-c',
      `model_reasoning_effort="${effort}"`,
      '--model',
      model,
      '-',
    ],
  };
}
