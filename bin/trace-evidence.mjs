#!/usr/bin/env node
/**
 * WHAT: Launches the compiled generalized trace-evidence CLI from the repository root.
 * WHY: Agents need a stable executable independent of package working directory.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'trace-evidence/dist/bin/trace-evidence.js');
// WHAT: Reject an unbuilt package with one actionable error.
// WHY: Running TypeScript through an ambient loader would make production behavior environment-dependent.
if (!existsSync(entry)) {
  process.stderr.write('trace-evidence is not built; run npm --prefix trace-evidence ci && npm --prefix trace-evidence run build.\n');
  process.exitCode = 1;
} else {
  // WHAT: Forward the command to the compiled package entrypoint.
  // WHY: The root launcher remains a stable alias while implementation stays package-owned.
  const [command = 'help', ...args] = process.argv.slice(2);
  const child = spawn(process.execPath, [entry, command, '--repo-root', root, ...args], { stdio: 'inherit', env: process.env });
  child.once('error', (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  child.once('close', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
