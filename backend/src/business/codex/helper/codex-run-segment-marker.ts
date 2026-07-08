type CodexRunSegment = 'start' | 'continue';

const markerPrefix = 'decision-os:codex-run-segment ';

export function codexRunSegmentMarker(input: { runId: string; startedAt: string; segment: CodexRunSegment }): string {
  return `${markerPrefix}${JSON.stringify({ runId: input.runId, startedAt: input.startedAt, segment: input.segment })}\n`;
}

export function latestCodexRunSegmentStartedAtMs(input: { log: string; runId: string }): number {
  let latest = 0;
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.startsWith(markerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(markerPrefix.length)) as { runId?: unknown; startedAt?: unknown };
      if (String(parsed.runId ?? '') !== input.runId) continue;
      const timestamp = Date.parse(String(parsed.startedAt ?? ''));
      if (Number.isFinite(timestamp) && timestamp > 0) latest = timestamp;
    } catch {
      // Ignore malformed marker lines; older and later valid markers remain usable.
    }
  }
  return latest;
}
