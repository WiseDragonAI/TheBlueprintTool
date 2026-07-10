type CodexRunSegment = 'start' | 'continue' | 'restart';

const markerPrefix = 'decision-os:codex-run-segment ';

export type CodexRunSegmentMetadata = {
  sourceCardTitle?: string;
  sourceThreadId?: string;
  codexModel?: string;
  codexEffort?: string;
};

function cleanMetadata(input: CodexRunSegmentMetadata = {}): CodexRunSegmentMetadata {
  const metadata: CodexRunSegmentMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim()) metadata[key as keyof CodexRunSegmentMetadata] = value.trim();
  }
  return metadata;
}

export function codexRunSegmentMarker(input: { runId: string; startedAt: string; segment: CodexRunSegment; metadata?: CodexRunSegmentMetadata }): string {
  const metadata = cleanMetadata(input.metadata);
  return `${markerPrefix}${JSON.stringify({ runId: input.runId, startedAt: input.startedAt, segment: input.segment, ...(Object.keys(metadata).length > 0 ? { metadata } : {}) })}\n`;
}

export function codexRunSegmentMetadata(input: { log: string; runId: string }): CodexRunSegmentMetadata {
  let metadata: CodexRunSegmentMetadata = {};
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.startsWith(markerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(markerPrefix.length)) as { runId?: unknown; metadata?: unknown };
      if (String(parsed.runId ?? '') !== input.runId || !parsed.metadata || typeof parsed.metadata !== 'object' || Array.isArray(parsed.metadata)) continue;
      metadata = { ...metadata, ...cleanMetadata(parsed.metadata as CodexRunSegmentMetadata) };
    } catch {
      // Ignore malformed marker lines; older and later valid markers remain usable.
    }
  }
  return metadata;
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
