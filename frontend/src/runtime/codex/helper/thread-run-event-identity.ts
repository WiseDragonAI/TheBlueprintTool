/**
 * WHAT: Derives stable logical and physical identities for Codex run log events.
 * WHY: Incremental polling must coalesce tool lifecycles while deduplicating replayed source lines.
 */
import type { CardSkillRunEvent } from '../effect/request-card-skill-run-status.js';

export function threadRunEventRunId(event: Partial<CardSkillRunEvent>, fallbackRunId: string): string {
  return String(event.runId ?? fallbackRunId).trim();
}

export function threadRunEventSourceIdentity(event: Partial<CardSkillRunEvent>): string {
  const source = event.source === 'stderr' ? 'stderr' : 'jsonl';
  const sourceLine = Math.max(0, Number(event.sourceLine ?? event.line ?? 0) || 0);
  return `${source}:${sourceLine}`;
}

export function threadRunToolKey(event: Partial<CardSkillRunEvent>, fallbackRunId = ''): string {
  // WHAT: Exclude non-tool events from tool lifecycle coalescing.
  // WHY: Ordinary events retain their physical source identity and chronological position.
  if (String(event.kind ?? '') !== 'tool_call') return '';
  const runId = threadRunEventRunId(event, fallbackRunId);
  const itemId = String(event.itemId ?? '').trim();
  return itemId ? `${runId}:item:${itemId}` : `${runId}:line:${threadRunEventSourceIdentity(event)}`;
}

export function threadRunLifecycleKey(event: Partial<CardSkillRunEvent>, fallbackRunId = ''): string {
  const kind = String(event.kind ?? '');
  if (kind !== 'tool_call' && kind !== 'todo_list') return '';
  const runId = threadRunEventRunId(event, fallbackRunId);
  const itemId = String(event.itemId ?? '').trim();
  return itemId ? `${runId}:item:${itemId}` : '';
}

export function threadRunEventKey(event: Partial<CardSkillRunEvent>, fallbackRunId = ''): string {
  const runId = threadRunEventRunId(event, fallbackRunId);
  const lifecycleKey = threadRunLifecycleKey(event, fallbackRunId);
  return lifecycleKey || threadRunToolKey(event, fallbackRunId) || `${runId}:event:${threadRunEventSourceIdentity(event)}`;
}
