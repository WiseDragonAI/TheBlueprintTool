/**
 * WHAT: Returns a bounded event-type projection from one catalog-owned Codex run.
 * WHY: Agents should not scan every Decision OS run and Codex session to recover a few events.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;
const skipped = new Set(['.git', '.worktrees', 'node_modules']);
function record(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function clipped(value: unknown, limit = 4000): unknown {
  if (typeof value === 'string') return value.length > limit ? `${value.slice(0, limit)}…` : value;
  return value;
}

function projectRoots(root: string): Array<{ projectId: string; decisionOsRoot: string }> {
  const result: Array<{ projectId: string; decisionOsRoot: string }> = [];
  const visit = (directory: string): void => {
    const decisionOsRoot = resolve(directory, '.decision-os');
    if (existsSync(resolve(decisionOsRoot, 'state.json'))) {
      const rel = relative(root, directory).split(sep).join('/') || '.';
      let projectId = Buffer.from(rel, 'utf8').toString('base64url');
      try { projectId = String(JSON.parse(readFileSync(resolve(decisionOsRoot, 'project.json'), 'utf8')).id ?? projectId); } catch { /* legacy project */ }
      result.push({ projectId, decisionOsRoot });
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || skipped.has(entry.name) || entry.name === '.decision-os') continue;
      visit(resolve(directory, entry.name));
    }
  };
  visit(root);
  return result;
}

function findRunFiles(directory: string, runId: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findRunFiles(path, runId);
    return basename(entry.name, '.jsonl') === runId && entry.name.endsWith('.jsonl') ? [path] : [];
  });
}

export function resolveCodexRunEvents(input: { root?: string; runId: string; itemType: string; limit?: number }): Result<string> {
  const root = resolve(input.root ?? process.env.DECISION_OS_MASTER_ROOT ?? resolve(process.env.DECISION_OS_LEDGER_ROOT ?? process.cwd(), '..'));
  const matches = projectRoots(root).flatMap((project) => findRunFiles(resolve(project.decisionOsRoot, 'runs', 'codex-skills'), input.runId).map((file) => ({ ...project, file })));
  if (matches.length === 0) return { ok: false, error: JSON.stringify({ version: 1, code: 'run_not_found', runId: input.runId }) };
  if (matches.length > 1) return { ok: false, error: JSON.stringify({ version: 1, code: 'ambiguous_run', runId: input.runId, projectIds: matches.map((entry) => entry.projectId) }) };
  const match = matches[0];
  const limit = Math.min(500, Math.max(1, Number(input.limit ?? 100)));
  const events = readFileSync(match.file, 'utf8').split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      const event = JSON.parse(line) as JsonObject;
      const item = record(event.item) ? event.item : {};
      if (String(item.type ?? '') !== input.itemType) return [];
      return [{
        line: index + 1,
        type: String(event.type ?? ''),
        itemId: String(item.id ?? event.id ?? ''),
        itemType: String(item.type ?? ''),
        status: String(item.status ?? event.status ?? ''),
        text: clipped(item.text ?? item.message ?? ''),
        items: Array.isArray(item.items) ? item.items.slice(0, 200) : undefined,
        output: clipped(item.output ?? item.aggregated_output ?? ''),
      }];
    } catch { return []; }
  }).slice(0, limit);
  return { ok: true, value: JSON.stringify({ version: 1, projectId: match.projectId, runId: input.runId, itemType: input.itemType, truncated: events.length === limit, events }, null, 2) };
}
