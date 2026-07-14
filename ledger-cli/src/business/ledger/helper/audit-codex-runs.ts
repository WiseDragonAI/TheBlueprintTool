/**
 * WHAT: Audits the newest Codex runs across every discovered Decision OS project.
 * WHY: Efficiency changes need one reproducible cross-project measurement command.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import type { Result } from '../../../lib/types.js';

type Row = { projectId?: string; startedAt?: string; completedAt?: string; durationMs?: number | null; tool?: string; command?: string; success?: boolean; outputBytes?: number; runId?: string; turnId?: string; callId?: string; status?: string };
const skipped = new Set(['.git', '.worktrees', 'node_modules']);
function epoch(runId: string): number { return Number(runId.match(/^codex-(?:skill|pipeline)-(\d+)-/)?.[1] ?? 0); }
function percentile(values: number[], fraction: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]; }
function normalizedTool(value: string): string { return value.replace(/\/[^\s"']+/g, '<path>').replace(/\s+/g, ' ').trim(); }

function projects(root: string): Array<{ projectId: string; root: string; decisionOsRoot: string }> {
  const result: Array<{ projectId: string; root: string; decisionOsRoot: string }> = [];
  const visit = (directory: string): void => {
    if (existsSync(resolve(directory, '.decision-os', 'state.json'))) {
      const rel = relative(root, directory).split(sep).join('/') || '.';
      let projectId = Buffer.from(rel, 'utf8').toString('base64url');
      try { projectId = String(JSON.parse(readFileSync(resolve(directory, '.decision-os', 'project.json'), 'utf8')).id ?? projectId); } catch { /* legacy id */ }
      result.push({ projectId, root: directory, decisionOsRoot: resolve(directory, '.decision-os') });
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || skipped.has(entry.name) || entry.name === '.decision-os') continue;
      visit(resolve(directory, entry.name));
    }
  };
  visit(root);
  return result;
}

function runFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? runFiles(resolve(directory, entry.name)) : entry.name.endsWith('.jsonl') && !entry.name.endsWith('.telemetry.jsonl') ? [resolve(directory, entry.name)] : []);
}

export function auditCodexRuns(input: { root?: string; count: number; cutoff?: number; exclusions: string[] }): Result<string> {
  const root = resolve(input.root ?? process.env.DECISION_OS_MASTER_ROOT ?? process.cwd());
  const excluded = new Set(input.exclusions);
  const runs = projects(root).flatMap((project) => runFiles(resolve(project.decisionOsRoot, 'runs', 'codex-skills')).map((file) => ({ project, file, runId: basename(file, '.jsonl') })))
    .filter((run) => epoch(run.runId) > 0 && (!input.cutoff || epoch(run.runId) < input.cutoff) && !excluded.has(run.runId))
    .sort((left, right) => epoch(right.runId) - epoch(left.runId) || left.runId.localeCompare(right.runId))
    .slice(0, Math.max(1, input.count));
  const selected = runs.map((run) => {
    const telemetryFile = `${run.file}.telemetry.jsonl`;
    const rows: Row[] = existsSync(telemetryFile) ? readFileSync(telemetryFile, 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line) as Row]; } catch { return []; } }) : [];
    return { projectId: run.project.projectId, projectRoot: run.project.root, runId: run.runId, startedEpoch: epoch(run.runId), runFile: run.file, telemetryAvailable: rows.length > 0, rows };
  });
  const rows = selected.flatMap((run) => run.rows);
  const durations = rows.flatMap((row) => typeof row.durationMs === 'number' && Number.isFinite(row.durationMs) && row.durationMs > 0 ? [row.durationMs] : []);
  const repeated = new Map<string, number>();
  for (const row of rows) { const key = normalizedTool(String(row.tool ?? '')); if (key) repeated.set(key, (repeated.get(key) ?? 0) + 1); }
  const output = {
    version: 1,
    root,
    selection: selected.map(({ rows: _rows, ...run }) => run),
    aggregate: {
      runs: selected.length,
      toolCalls: rows.length,
      failures: rows.filter((row) => row.success === false).length,
      outputBytes: rows.reduce((sum, row) => sum + Number(row.outputBytes ?? 0), 0),
      medianLatencyMs: percentile(durations, 0.5),
      p95LatencyMs: percentile(durations, 0.95),
      historicalLatencyUnavailableRuns: selected.filter((run) => !run.telemetryAvailable).map((run) => run.runId),
      incompleteIdentityRows: rows.filter((row) => !row.projectId || !row.runId || !row.turnId || !row.callId).length,
      unavailableDurationRows: rows.filter((row) => typeof row.durationMs !== 'number' || !Number.isFinite(row.durationMs) || row.durationMs <= 0).length,
      repeatedCalls: [...repeated.entries()].filter(([, count]) => count > 1).sort((left, right) => right[1] - left[1]).map(([tool, count]) => ({ tool, count })),
    },
  };
  return { ok: true, value: JSON.stringify(output, null, 2) };
}
