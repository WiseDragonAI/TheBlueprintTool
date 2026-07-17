type CodexRunSegment = 'start' | 'continue' | 'restart';

const markerPrefix = 'decision-os:codex-run-segment ';
const turnMarkerPrefix = 'decision-os:codex-turn-start ';

export function isCodexRunMarkerLine(line: string): boolean {
  return line.startsWith(markerPrefix) || line.startsWith(turnMarkerPrefix);
}

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

export function codexRunSegmentMarker(input: { runId: string; startedAt: string; segment: CodexRunSegment; startLine?: number; metadata?: CodexRunSegmentMetadata }): string {
  const metadata = cleanMetadata(input.metadata);
  const startLine = Number.isFinite(input.startLine) ? Math.max(0, Math.floor(Number(input.startLine))) : undefined;
  return `${markerPrefix}${JSON.stringify({ runId: input.runId, startedAt: input.startedAt, segment: input.segment, ...(startLine === undefined ? {} : { startLine }), ...(Object.keys(metadata).length > 0 ? { metadata } : {}) })}\n`;
}

export function codexRunTurnStartedMarker(input: { runId: string; startedAt: string; line: number }): string {
  return `${turnMarkerPrefix}${JSON.stringify({ runId: input.runId, startedAt: input.startedAt, line: Math.max(1, Math.floor(input.line)) })}\n`;
}

export function latestCodexRunTurnStartedAtMs(input: { log: string; runId: string }): number {
  let latest = 0;
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.startsWith(turnMarkerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(turnMarkerPrefix.length)) as { runId?: unknown; startedAt?: unknown };
      if (String(parsed.runId ?? '') !== input.runId) continue;
      const timestamp = Date.parse(String(parsed.startedAt ?? ''));
      if (Number.isFinite(timestamp) && timestamp > 0) latest = timestamp;
    } catch {
      // Ignore malformed marker lines; later valid turn markers remain usable.
    }
  }
  return latest;
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

export function latestCodexRunSegmentStartLine(input: { log: string; runId: string }): number {
  let latest = 0;
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.startsWith(markerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(markerPrefix.length)) as { runId?: unknown; startLine?: unknown };
      if (String(parsed.runId ?? '') !== input.runId) continue;
      const startLine = Number(parsed.startLine ?? 0);
      if (Number.isFinite(startLine) && startLine >= 0) latest = Math.floor(startLine);
    } catch {
      // Ignore malformed marker lines; older and later valid markers remain usable.
    }
  }
  return latest;
}

export function latestCodexRunSegmentLog(input: { log: string; runId: string }): string {
  const lines = input.log.replace(/\r\n?/g, '\n').split('\n');
  let latestMarkerIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith(markerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(markerPrefix.length)) as { runId?: unknown };
      if (String(parsed.runId ?? '') === input.runId) latestMarkerIndex = index;
    } catch {
      // Ignore malformed marker lines; older and later valid markers remain usable.
    }
  }
  return latestMarkerIndex >= 0 ? lines.slice(latestMarkerIndex + 1).join('\n') : input.log;
}
