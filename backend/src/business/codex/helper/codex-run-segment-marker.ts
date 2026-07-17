export type CodexRunSegment = 'start' | 'continue' | 'restart';

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

export type CodexRunExecution = {
  executionId: string;
  runId: string;
  segment: CodexRunSegment;
  startedAt: string;
  startLine: number;
  turnStartedAt: string;
  turnStartLine: number;
};

function cleanMetadata(input: CodexRunSegmentMetadata = {}): CodexRunSegmentMetadata {
  const metadata: CodexRunSegmentMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim()) metadata[key as keyof CodexRunSegmentMetadata] = value.trim();
  }
  return metadata;
}

export function codexRunSegmentMarker(input: { runId: string; executionId?: string; startedAt: string; segment: CodexRunSegment; startLine?: number; metadata?: CodexRunSegmentMetadata }): string {
  const metadata = cleanMetadata(input.metadata);
  const startLine = Number.isFinite(input.startLine) ? Math.max(0, Math.floor(Number(input.startLine))) : undefined;
  const executionId = String(input.executionId ?? '').trim() || `${input.runId}:execution:${startLine ?? 0}`;
  return `${markerPrefix}${JSON.stringify({ runId: input.runId, executionId, startedAt: input.startedAt, segment: input.segment, ...(startLine === undefined ? {} : { startLine }), ...(Object.keys(metadata).length > 0 ? { metadata } : {}) })}\n`;
}

export function codexRunTurnStartedMarker(input: { runId: string; executionId?: string; startedAt: string; line: number }): string {
  return `${turnMarkerPrefix}${JSON.stringify({ runId: input.runId, executionId: String(input.executionId ?? '').trim(), startedAt: input.startedAt, line: Math.max(1, Math.floor(input.line)) })}\n`;
}

export function codexRunExecutions(input: { log: string; runId: string }): CodexRunExecution[] {
  const executions: CodexRunExecution[] = [];
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith(markerPrefix)) {
      try {
        const parsed = JSON.parse(line.slice(markerPrefix.length)) as Record<string, unknown>;
        if (String(parsed.runId ?? '') !== input.runId) continue;
        const startLine = Math.max(0, Math.floor(Number(parsed.startLine ?? 0) || 0));
        const segment = ['start', 'continue', 'restart'].includes(String(parsed.segment ?? '')) ? String(parsed.segment) as CodexRunSegment : 'continue';
        executions.push({ executionId: String(parsed.executionId ?? '').trim() || `${input.runId}:execution:${startLine}`, runId: input.runId, segment, startedAt: String(parsed.startedAt ?? ''), startLine, turnStartedAt: '', turnStartLine: 0 });
      } catch {
        // Later valid markers remain authoritative.
      }
      continue;
    }
    if (!line.startsWith(turnMarkerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(turnMarkerPrefix.length)) as Record<string, unknown>;
      if (String(parsed.runId ?? '') !== input.runId) continue;
      const executionId = String(parsed.executionId ?? '').trim();
      const execution = (executionId ? [...executions].reverse().find((entry) => entry.executionId === executionId) : undefined) ?? executions.at(-1);
      if (!execution) continue;
      execution.turnStartedAt = String(parsed.startedAt ?? '');
      execution.turnStartLine = Math.max(1, Math.floor(Number(parsed.line ?? 0) || 0));
    } catch {
      // Later valid markers remain authoritative.
    }
  }
  return executions;
}

export function latestCodexRunTurnStartedAtMs(input: { log: string; runId: string }): number {
  let latest = 0;
  for (const line of input.log.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.startsWith(turnMarkerPrefix)) continue;
    try {
      const parsed = JSON.parse(line.slice(turnMarkerPrefix.length)) as { runId?: unknown; startedAt?: unknown };
      if (String(parsed.runId ?? '') !== input.runId) continue;
      latest = Date.parse(String(parsed.startedAt ?? '')) || latest;
    } catch {
      // Later valid markers remain authoritative.
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
  return Date.parse(codexRunExecutions(input).at(-1)?.startedAt ?? '') || 0;
}

export function latestCodexRunSegmentStartLine(input: { log: string; runId: string }): number {
  return codexRunExecutions(input).at(-1)?.startLine ?? 0;
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
