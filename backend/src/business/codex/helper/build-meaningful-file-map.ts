/**
 * WHAT: Executes the bounded file-map CLI for the FILE_MAP runtime variable.
 * WHY: Prompt injection and on-demand repository queries must use one map implementation.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fileMapCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../tools/map.mjs');
const maximumFileMapBytes = 1024 * 1024;
const fileMapTimeoutMs = 10_000;

export function buildMeaningfulFileMap(workspaceRoot: string): string {
  try {
    return execFileSync(process.execPath, [fileMapCli], {
      cwd: workspaceRoot,
      encoding: 'buffer',
      timeout: fileMapTimeoutMs,
      maxBuffer: maximumFileMapBytes,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8').trimEnd();
  } catch {
    return 'DOMAINS\n (unavailable)\nCODE\n.\n (file map unavailable)';
  }
}
