/**
 * WHAT: Builds the project-scoped environment and command shims shared by every Decision OS Codex child.
 * WHY: Codex must receive stable ledger and research commands without discovering repository paths.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, delimiter, resolve } from 'node:path';
import type { Server } from 'node:http';
import { spawnSync } from 'node:child_process';

type AnyRecord = Record<string, unknown>;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function installCommandShim(input: {
  command: string;
  directory: string;
  launcher: string;
  nodeExecutable: string;
}): void {
  const shim = resolve(input.directory, input.command);
  writeFileSync(shim, `#!/bin/sh\nexec ${shellQuote(input.nodeExecutable)} ${shellQuote(input.launcher)} \"$@\"\n`, { encoding: 'utf8', mode: 0o700 });
  chmodSync(shim, 0o700);
  const verified = spawnSync(shim, ['--help'], { encoding: 'utf8' });
  // WHAT: reject a command shim that cannot execute its launcher.
  // WHY: child prompts must not receive a broken command contract.
  if (verified.status !== 0) {
    throw new Error(`${input.command} shim verification failed: ${verified.stderr || verified.error?.message || `exit ${verified.status}`}`);
  }
}

export function ensureLedgerCliShim(input: {
  masterDecisionOsRoot: string;
  launcher: string;
  webpageLauncher: string;
  nodeExecutable?: string;
}): string {
  const launcher = resolve(input.launcher);
  const webpageLauncher = resolve(input.webpageLauncher);
  const nodeExecutable = resolve(input.nodeExecutable ?? process.execPath);
  // WHAT: reject a missing ledger launcher before writing command shims.
  // WHY: the runtime cannot satisfy its ledger mutation contract without it.
  if (!existsSync(launcher)) throw new Error(`Ledger CLI launcher not found: ${launcher}`);
  // WHAT: reject a missing webpage launcher before writing command shims.
  // WHY: research prompts require the documented source-capture command.
  if (!existsSync(webpageLauncher)) throw new Error(`Webpage CLI launcher not found: ${webpageLauncher}`);
  // WHAT: reject a missing Node executable before writing command shims.
  // WHY: every generated shim delegates to this exact runtime.
  if (!existsSync(nodeExecutable)) throw new Error(`Node executable not found: ${nodeExecutable}`);
  const directory = resolve(input.masterDecisionOsRoot, 'runtime', 'bin');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  installCommandShim({ command: 'ledger-cli', directory, launcher, nodeExecutable });
  installCommandShim({ command: 'download-webpage', directory, launcher: webpageLauncher, nodeExecutable });
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

export function decisionOsCodexEnvironment(input: {
  runtime: AnyRecord;
  decisionOsRoot: string;
  ledgerFile: string;
  executionId?: string;
}): NodeJS.ProcessEnv {
  const shimDirectory = String(input.runtime.ledgerCliShimDirectory ?? '').trim();
  return {
    ...process.env,
    PATH: shimDirectory ? `${shimDirectory}${delimiter}${process.env.PATH ?? ''}` : process.env.PATH,
    DECISION_OS_PROJECT_ID: String(input.runtime.projectId ?? ''),
    DECISION_OS_LEDGER_ROOT: resolve(input.decisionOsRoot),
    DECISION_OS_LEDGER_FILE: resolve(input.ledgerFile),
    DECISION_OS_SERVER_URL: serverUrl(input.runtime),
    DECISION_OS_MASTER_ROOT: String(input.runtime.serverRoot ?? dirname(resolve(input.decisionOsRoot))),
    ...(input.executionId ? { DECISION_OS_EXECUTION_ID: input.executionId } : {}),
  };
}

export const ledgerCliPromptLine = 'ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.';
