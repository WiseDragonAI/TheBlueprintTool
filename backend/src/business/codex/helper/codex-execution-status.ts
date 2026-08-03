/**
 * WHAT: Resolves one durable execution into elapsed time and its latest Codex token status.
 * WHY: Agents need a read-only self-query without duplicating provider session state.
 */
import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';

type AnyRecord = Record<string, unknown>;
type Execution = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;

export type CodexExecutionStatus = {
  executionId: string;
  phase: string;
  elapsed: { milliseconds: number; startedAt: string | null; finishedAt: string | null };
  providerSession: { available: boolean; id: string | null };
  context: { available: boolean; usedTokens: number | null; windowTokens: number | null; remainingTokens: number | null; remainingPercent: number | null };
  limits: Array<{ name: string; usedPercent: number; remainingPercent: number; windowMinutes: number; resetsAt: string }>;
};

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function sessionFiles(root: string): string[] {
  // WHAT: Return no candidates when Codex has not created its session store.
  // WHY: Missing provider data must not fail durable elapsed-time reporting.
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => join(entry.parentPath, entry.name));
}

function *completeLines(file: string): Generator<string> {
  const descriptor = openSync(file, 'r');
  const decoder = new StringDecoder('utf8');
  let remainder = '';
  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(64 * 1024);
      const bytes = readSync(descriptor, chunk, 0, chunk.length, null);
      // WHAT: End the stream at the observed file boundary.
      // WHY: Active Codex appends are handled by the next status query.
      if (bytes === 0) break;
      remainder += decoder.write(chunk.subarray(0, bytes));
      let newline = remainder.indexOf('\n');
      while (newline >= 0) {
        yield remainder.slice(0, newline).replace(/\r$/, '');
        remainder = remainder.slice(newline + 1);
        newline = remainder.indexOf('\n');
      }
    }
    remainder += decoder.end();
    // WHAT: Yield a final record only when it is complete JSON.
    // WHY: Codex may omit the final newline after a settled session.
    if (remainder.trim()) {
      try { JSON.parse(remainder); yield remainder; } catch { /* Preserve and ignore the incomplete tail. */ }
    }
  } finally {
    closeSync(descriptor);
  }
}

function firstCompleteLine(file: string): string | null {
  for (const line of completeLines(file)) {
    // WHAT: Return the first non-empty provider record.
    // WHY: Session metadata is the canonical first JSONL event.
    if (line.trim()) return line;
  }
  return null;
}

function matchingSessionFile(root: string, providerSessionId: string): string | null {
  for (const file of sessionFiles(root).filter((candidate) => candidate.includes(providerSessionId))) {
    const firstLine = firstCompleteLine(file);
    // WHAT: Reject empty session candidates.
    // WHY: Filename similarity cannot authorize reading another provider session.
    if (!firstLine) continue;
    try {
      const event = JSON.parse(firstLine) as AnyRecord;
      const payload = record(event.payload);
      // WHAT: Select only canonical matching session metadata.
      // WHY: Provider session identity is the read boundary for Codex usage data.
      if (event.type === 'session_meta' && (payload?.id === providerSessionId || payload?.session_id === providerSessionId)) return file;
    } catch {
      // WHAT: Ignore an invalid candidate while preserving its bytes.
      // WHY: Status reads are observational and malformed files remain provider-owned.
      continue;
    }
  }
  return null;
}

function latestTokenStatus(file: string | null): AnyRecord | null {
  // WHAT: Mark provider metrics unavailable when no matching file exists.
  // WHY: Execution lifecycle remains useful before Codex persists its session.
  if (!file) return null;
  let latest: AnyRecord | null = null;
  for (const line of completeLines(file)) {
    // WHAT: Ignore blank JSONL records.
    // WHY: A final newline is not a torn record.
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const payload = record(event.payload);
      // WHAT: Retain only complete token-count events.
      // WHY: The newest complete status event is Codex's current displayed authority.
      if (event.type === 'event_msg' && payload?.type === 'token_count') latest = payload;
    } catch {
      // WHAT: Stop at the first incomplete JSONL tail.
      // WHY: Later bytes cannot be a complete ordered record after a torn append.
      break;
    }
  }
  return latest;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function codexExecutionStatus(input: { execution: Execution; now?: Date; codexHome?: string; providerSessionId?: string | null }): CodexExecutionStatus {
  const now = input.now ?? new Date();
  const lifecycle = input.execution.lifecycle;
  const startMs = Date.parse(lifecycle.startedAt ?? input.execution.metadata.requestedAt);
  const endMs = Date.parse(lifecycle.finishedAt ?? now.toISOString());
  const providerSessionId = lifecycle.providerSessionId ?? input.providerSessionId ?? null;
  const file = providerSessionId
    ? matchingSessionFile(resolve(input.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions'), providerSessionId)
    : null;
  const status = latestTokenStatus(file);
  const info = record(status?.info);
  const last = record(info?.last_token_usage);
  const usedTokens = finiteNumber(last?.total_tokens);
  const windowTokens = finiteNumber(info?.model_context_window);
  const contextAvailable = usedTokens !== null && windowTokens !== null && windowTokens > 0;
  const baselineTokens = 12_000;
  const effectiveWindowTokens = contextAvailable ? Math.max(0, windowTokens - baselineTokens) : 0;
  const effectiveUsedTokens = contextAvailable ? Math.max(0, usedTokens - baselineTokens) : 0;
  const remainingTokens = contextAvailable ? Math.max(0, effectiveWindowTokens - effectiveUsedTokens) : null;
  const remainingPercent = contextAvailable && effectiveWindowTokens > 0
    ? Math.round(Math.max(0, Math.min(100, (remainingTokens! / effectiveWindowTokens) * 100)))
    : contextAvailable ? 0 : null;
  const rateLimits = record(status?.rate_limits);
  const limits = ['primary', 'secondary'].flatMap((name) => {
    const window = record(rateLimits?.[name]);
    const usedPercent = finiteNumber(window?.used_percent);
    const windowMinutes = finiteNumber(window?.window_minutes);
    const resetsAt = finiteNumber(window?.resets_at);
    // WHAT: Omit unavailable limit windows independently.
    // WHY: Codex plans expose different combinations of primary and secondary windows.
    if (usedPercent === null || windowMinutes === null || resetsAt === null) return [];
    return [{ name, usedPercent, remainingPercent: Math.max(0, Math.min(100, 100 - usedPercent)), windowMinutes, resetsAt: new Date(resetsAt * 1000).toISOString() }];
  });
  return {
    executionId: input.execution.metadata.executionId,
    phase: lifecycle.phase,
    elapsed: { milliseconds: Math.max(0, endMs - startMs), startedAt: lifecycle.startedAt, finishedAt: lifecycle.finishedAt },
    providerSession: { available: Boolean(providerSessionId), id: providerSessionId },
    context: { available: contextAvailable, usedTokens, windowTokens, remainingTokens, remainingPercent },
    limits,
  };
}
