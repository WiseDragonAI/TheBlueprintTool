/**
 * WHAT: Summarizes one sequential Codex tool group by count and lifecycle status.
 * WHY: Collapsed disclosures need a stable overview without inspecting their DOM children.
 */
import type { ThreadRunToolGroup } from './thread-run-log.js';

export function threadRunToolGroupSummary(group: ThreadRunToolGroup): string {
  const count = group.tools.length;
  const statuses = new Map<string, number>();
  for (const tool of group.tools) {
    const status = tool.status || 'pending';
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
  }
  const counts = [...statuses.entries()].map(([status, value]) => `${value} ${status}`).join(' · ');
  return `${count} ${count === 1 ? 'tool' : 'tools'}${counts ? ` · ${counts}` : ''}`;
}
