#!/usr/bin/env node
/**
 * WHAT: Reports phone memory and heavyweight Codex verification processes.
 * WHY: Agents need a cheap cooperative admission check without lock ownership.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIB = 1024;
const MIN_AVAILABLE_KIB = 1024 * 1024;
const MAX_SWAP_USED_RATIO = 0.75;

export function parseMeminfo(text) {
  return Object.fromEntries([...text.matchAll(/^([^:]+):\s+(\d+)\s+kB$/gm)].map((match) => [match[1], Number(match[2])]));
}

function processKind(argv) {
  const executable = basename(argv[0] ?? '');
  const command = argv.slice(1).join(' ');
  if (/^(node|nodejs)$/.test(executable) && /(?:^|\s)--test(?:\s|$)/.test(command) && !command.includes('--test-child-v8')) return 'test';
  if (/^(node|nodejs)$/.test(executable) && /(?:^|[/\\])(?:tsc|tsc\.js)(?:\s|$)/.test(command)) return 'typecheck';
  if ((executable === 'codex' || executable === 'codex.bin') && argv.includes('exec')) return 'codex';
  return '';
}

export function classifyProcesses(processes) {
  return processes.flatMap((process) => {
    const kind = processKind(process.argv);
    return kind ? [{ ...process, kind }] : [];
  });
}

function readProcesses(procRoot = '/proc') {
  return readdirSync(procRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) return [];
    try {
      const root = `${procRoot}/${entry.name}`;
      const argv = readFileSync(`${root}/cmdline`).toString().split('\0').filter(Boolean);
      if (argv.length === 0) return [];
      const status = readFileSync(`${root}/status`, 'utf8');
      const rssKib = Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1] ?? 0);
      return [{ pid: Number(entry.name), rssKib, argv }];
    } catch {
      return [];
    }
  });
}

function gib(kib) {
  return `${(kib / KIB / KIB).toFixed(1)}GiB`;
}

export function buildStatus(meminfo, processes) {
  const classified = classifyProcesses(processes);
  const heavy = classified.filter(({ kind }) => kind !== 'codex');
  const availableKib = meminfo.MemAvailable ?? 0;
  const swapTotalKib = meminfo.SwapTotal ?? 0;
  const swapUsedKib = Math.max(0, swapTotalKib - (meminfo.SwapFree ?? 0));
  const swapUsedRatio = swapTotalKib === 0 ? 0 : swapUsedKib / swapTotalKib;
  const reasons = [];
  if (heavy.length > 0) reasons.push('heavy-process');
  if (availableKib < MIN_AVAILABLE_KIB) reasons.push('low-memory');
  if (swapUsedRatio >= MAX_SWAP_USED_RATIO) reasons.push('high-swap');
  return {
    decision: reasons.length === 0 ? 'GO' : 'WAIT',
    reasons,
    availableKib,
    totalKib: meminfo.MemTotal ?? 0,
    swapUsedKib,
    swapTotalKib,
    codexCount: classified.filter(({ kind }) => kind === 'codex').length,
    heavy
  };
}

export function formatStatus(status) {
  const reason = status.reasons.length > 0 ? ` reason=${status.reasons.join(',')}` : '';
  const lines = [
    `${status.decision}${reason} heavy=${status.heavy.length} codex=${status.codexCount} mem=${gib(status.availableKib)}/${gib(status.totalKib)} swap=${gib(status.swapUsedKib)}/${gib(status.swapTotalKib)}`
  ];
  for (const process of status.heavy) {
    lines.push(`${process.kind.toUpperCase()} pid=${process.pid} rss=${Math.round(process.rssKib / KIB)}MiB`);
  }
  return lines.join('\n');
}

export function main() {
  const meminfo = parseMeminfo(readFileSync('/proc/meminfo', 'utf8'));
  process.stdout.write(`${formatStatus(buildStatus(meminfo, readProcesses()))}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
