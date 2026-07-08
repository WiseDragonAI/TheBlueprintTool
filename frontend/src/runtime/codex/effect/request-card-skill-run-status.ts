/**
 * WHAT: Requests the derived status for one card-scoped Codex skill run.
 * WHY: The card widget polls server-parsed JSONL progress without owning run persistence.
 */
export type CardSkillRunStatus = 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';

export type CardSkillRunEvent = {
  line: number;
  type: string;
  kind: string;
  title: string;
  text: string;
  status: string;
  itemId: string;
  tool: string;
  exitCode: string;
  persist: boolean;
};

export type CardSkillRunMetadata = {
  sourceCardTitle: string;
  sourceThreadId: string;
  codexModel: string;
  codexEffort: string;
};

export type CardSkillRunSummary = {
  ok: boolean;
  status: CardSkillRunStatus;
  startedAt: string;
  elapsedMs: number;
  lineCount: number;
  nextSince: number;
  toolCallCount: number;
  agentMessageCount: number;
  fileChangeCount: number;
  thinkingCount: number;
  persistedEventCount: number;
  metadata: CardSkillRunMetadata;
  latestEvent: CardSkillRunEvent | null;
  events: CardSkillRunEvent[];
  error?: string;
};

export async function requestCardSkillRunStatus(input: { ledgerId: string; cardId: string; runId: string; since?: number; traceId?: string }): Promise<CardSkillRunSummary> {
  const params = new URLSearchParams({
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    since: String(Math.max(0, Number(input.since ?? 0) || 0))
  });
  if (input.traceId) params.set('traceId', input.traceId);
  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}?${params.toString()}`).catch(() => undefined);
  const emptyMetadata = { sourceCardTitle: '', sourceThreadId: '', codexModel: '', codexEffort: '' };
  if (!response) return { ok: false, status: 'unknown', startedAt: '', elapsedMs: 0, lineCount: 0, nextSince: 0, toolCallCount: 0, agentMessageCount: 0, fileChangeCount: 0, thinkingCount: 0, persistedEventCount: 0, metadata: emptyMetadata, latestEvent: null, events: [], error: 'Request failed.' };
  const body = await response.json().catch(() => ({})) as Partial<CardSkillRunSummary>;
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : emptyMetadata;
  return {
    ok: response.ok && body.ok !== false,
    status: body.status ?? 'unknown',
    startedAt: String(body.startedAt ?? ''),
    elapsedMs: Number(body.elapsedMs ?? 0),
    lineCount: Number(body.lineCount ?? 0),
    nextSince: Number(body.nextSince ?? body.lineCount ?? 0),
    toolCallCount: Number(body.toolCallCount ?? 0),
    agentMessageCount: Number(body.agentMessageCount ?? 0),
    fileChangeCount: Number(body.fileChangeCount ?? 0),
    thinkingCount: Number(body.thinkingCount ?? 0),
    persistedEventCount: Number(body.persistedEventCount ?? 0),
    metadata: {
      sourceCardTitle: String(metadata.sourceCardTitle ?? ''),
      sourceThreadId: String(metadata.sourceThreadId ?? ''),
      codexModel: String(metadata.codexModel ?? ''),
      codexEffort: String(metadata.codexEffort ?? ''),
    },
    latestEvent: body.latestEvent ?? null,
    events: Array.isArray(body.events) ? body.events : [],
    error: String(body.error ?? ''),
  };
}
