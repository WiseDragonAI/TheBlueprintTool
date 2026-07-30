#!/usr/bin/env node
/**
 * WHAT: Prints a complete code, test, or documentation map for one optional top-level domain.
 * WHY: The injected FILE_MAP stays compact while exact repository paths remain one command away.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQueryFileMap } from '../shared/meaningful-file-map.mjs';

export function runFileMapCli(args, workspaceRoot = process.cwd()) {
  if (args.length < 1 || args.length > 2) {
    throw new Error('usage: tools/map.mjs <c|t|d> [domain]');
  }
  return buildQueryFileMap(workspaceRoot, args[0], args[1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.stdout.write(`${runFileMapCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
