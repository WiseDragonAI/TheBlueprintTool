#!/usr/bin/env node
/**
 * WHAT: Prints a complete code, test, or documentation map for one optional top-level domain.
 * WHY: FILE_MAP executes the compact default while exact repository paths remain one command away.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInjectedFileMap,
  buildQueryFileMap,
} from '../shared/meaningful-file-map.mjs';

export function runFileMapCli(args, workspaceRoot = process.cwd()) {
  if (args.length === 0) return buildInjectedFileMap(workspaceRoot);
  // WHAT: Accept one map kind plus optional repository-relative base directory and depth.
  // WHY: Agents need to query nested directories without receiving an unbounded tree.
  if (args.length < 1 || args.length > 3) {
    throw new Error('usage: tools/map.mjs <c|t|d> [base-directory] [depth]');
  }
  return buildQueryFileMap(workspaceRoot, args[0], args[1], args[2]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.stdout.write(`${runFileMapCli(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
