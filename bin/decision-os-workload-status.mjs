#!/usr/bin/env node
/**
 * WHAT: Reports active Decision OS test and typecheck processes.
 * WHY: Agents need one cooperative admission check before verification.
 */
import { readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decisionOsRoot = basename(dirname(scriptRepoRoot)) === '.worktrees'
  ? dirname(dirname(scriptRepoRoot))
  : scriptRepoRoot;

function processKind(argv) {
  const executable = basename(argv[0] ?? '');
  const command = argv.slice(1).join(' ');
  if (/^(node|nodejs)$/.test(executable) && /(?:^|\s)--test(?:\s|$)/.test(command) && !command.includes('--test-child-v8')) return 'test';
  if (/^(node|nodejs)$/.test(executable) && /(?:^|[/\\])(?:tsc|tsc\.js)(?:\s|$)/.test(command)) return 'typecheck';
  return '';
}

function inside(root, cwd) {
  return cwd === root || cwd.startsWith(`${root}${sep}`);
}

export function classifyProcesses(processes, root = decisionOsRoot) {
  return processes.flatMap((process) => {
    const kind = processKind(process.argv);
    return kind && inside(root, process.cwd) ? [{ ...process, kind }] : [];
  });
}

function readProcesses(procRoot = '/proc') {
  return readdirSync(procRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) return [];
    try {
      const root = `${procRoot}/${entry.name}`;
      const argv = readFileSync(`${root}/cmdline`).toString().split('\0').filter(Boolean);
      if (argv.length === 0) return [];
      return [{ pid: Number(entry.name), cwd: readlinkSync(`${root}/cwd`), argv }];
    } catch {
      return [];
    }
  });
}

export function buildStatus(processes, root = decisionOsRoot) {
  const active = classifyProcesses(processes, root);
  return {
    decision: active.length === 0 ? 'GO' : 'WAIT',
    tests: active.filter(({ kind }) => kind === 'test'),
    typechecks: active.filter(({ kind }) => kind === 'typecheck'),
    root
  };
}

export function formatStatus(status) {
  const lines = [`${status.decision} tests=${status.tests.length} typechecks=${status.typechecks.length}`];
  for (const process of [...status.tests, ...status.typechecks]) {
    const cwd = relative(status.root, process.cwd) || '.';
    lines.push(`${process.kind.toUpperCase()} pid=${process.pid} cwd=${cwd} command=${process.argv.slice(1).join(' ')}`);
  }
  return lines.join('\n');
}

export function main() {
  process.stdout.write(`${formatStatus(buildStatus(readProcesses()))}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
