/**
 * WHAT: Builds the project-scoped environment shared by every Decision OS Codex child.
 * WHY: Codex must receive one stable ledger command without discovering repository paths.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import type { Server } from 'node:http';
import { spawnSync } from 'node:child_process';

type AnyRecord = Record<string, unknown>;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function ensureLedgerCliShim(input: { masterDecisionOsRoot: string; launcher: string; nodeExecutable?: string }): string {
  const launcher = resolve(input.launcher);
  const nodeExecutable = resolve(input.nodeExecutable ?? process.execPath);
  if (!existsSync(launcher)) throw new Error(`Ledger CLI launcher not found: ${launcher}`);
  if (!existsSync(nodeExecutable)) throw new Error(`Node executable not found: ${nodeExecutable}`);
  const directory = resolve(input.masterDecisionOsRoot, 'runtime', 'bin');
  const shim = resolve(directory, 'ledger-cli');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(shim, `#!/bin/sh\nexec ${shellQuote(nodeExecutable)} ${shellQuote(launcher)} \"$@\"\n`, { encoding: 'utf8', mode: 0o700 });
  chmodSync(shim, 0o700);
  const verified = spawnSync(shim, ['--help'], { encoding: 'utf8' });
  if (verified.status !== 0) throw new Error(`Ledger CLI shim verification failed: ${verified.stderr || verified.error?.message || `exit ${verified.status}`}`);
  return directory;
}

function serverUrl(runtime: AnyRecord): string {
  const configured = String(runtime.decisionOsServerUrl ?? '').trim();
  if (configured) return configured;
  const server = runtime.server as Server | undefined;
  const address = server?.address();
  const port = address && typeof address === 'object' ? address.port : Number(runtime.port ?? 0);
  return port > 0 ? `http://127.0.0.1:${port}` : '';
}

export function decisionOsCodexEnvironment(input: { runtime: AnyRecord; decisionOsRoot: string; ledgerFile: string }): NodeJS.ProcessEnv {
  const shimDirectory = String(input.runtime.ledgerCliShimDirectory ?? '').trim();
  return {
    ...process.env,
    PATH: shimDirectory ? `${shimDirectory}${delimiter}${process.env.PATH ?? ''}` : process.env.PATH,
    DECISION_OS_PROJECT_ID: String(input.runtime.projectId ?? ''),
    DECISION_OS_LEDGER_ROOT: resolve(input.decisionOsRoot),
    DECISION_OS_LEDGER_FILE: resolve(input.ledgerFile),
    DECISION_OS_SERVER_URL: serverUrl(input.runtime),
  };
}

export const ledgerCliPromptLine = 'ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.';
