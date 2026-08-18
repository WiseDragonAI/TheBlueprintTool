#!/usr/bin/env node
/**
 * WHAT: Launches the compiled static codebase quality mapper from the repository root.
 * WHY: Agents need a stable command beside Trace Evidence without depending on package working directory.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'trace-evidence/dist/bin/codebase-quality-map.js');
// WHAT: Reject an unbuilt mapper with one actionable command.
// WHY: Runtime behavior must use the compiled and typechecked package.
if (!existsSync(entry)) {
  process.stderr.write('codebase-quality-map is not built; run npm --prefix trace-evidence run build.\n');
  process.exitCode = 1;
} else {
  // WHAT: Forward exact caller argv to the package-owned executable.
  // WHY: The root launcher remains stable while implementation stays linked to Trace Evidence.
  const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  child.once('error', (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  child.once('close', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
