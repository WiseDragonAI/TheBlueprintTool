/**
 * WHAT: Requests and normalizes derived status for one card-scoped Codex run.
 * WHY: Widgets and thread logs need the same stable incremental JSONL and diagnostic contract.
 */
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';

export type CardSkillRunStatus = 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';
export type CardSkillRunEventSource = 'jsonl' | 'stderr';
export type CardSkillRunEventSeverity = 'info' | 'warning' | 'error';

export type CardSkillRunEvent = {
  runId: string;
  line: number;
  source: CardSkillRunEventSource;
  sourceLine: number;
  type: string;
  kind: string;
  title: string;
  text: string;
  status: string;
  itemId: string;
  tool: string;
  output: string;
  exitCode: string;
  severity: CardSkillRunEventSeverity;
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
  active?: boolean;
  runId: string;
  runKind: 'thread' | 'card' | 'unknown';
  pipelineRunId: string;
  pipelineName: string;
  pipelineStepName: string;
  skillName: string;
  pipelineStatus: CardSkillRunStatus | '';
  status: CardSkillRunStatus;
  startedAt: string;
  elapsedMs: number;
  lineCount: number;
  nextSince: number;
  toolCallCount: number;
  agentMessageCount: number;
  fileChangeCount: number;
  thinkingCount: number;
  warningCount: number;
  errorCount: number;
  transportStatus: 'ok' | 'degraded' | 'unknown';
  persistedEventCount: number;
  metadata: CardSkillRunMetadata;
  latestEvent: CardSkillRunEvent | null;
  events: CardSkillRunEvent[];
  diagnostics: CardSkillRunEvent[];
  error?: string;
};

const emptyMetadata: CardSkillRunMetadata = {
  sourceCardTitle: '',
  sourceThreadId: '',
  codexModel: '',
  codexEffort: ''
};

function normalizedEvent(value: unknown, runId: string): CardSkillRunEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Partial<CardSkillRunEvent>;
  const source = event.source === 'stderr' ? 'stderr' : 'jsonl';
  const sourceLine = Math.max(0, Number(event.sourceLine ?? event.line ?? 0) || 0);
  const line = Math.max(0, Number(event.line ?? sourceLine) || 0);
  return {
    runId: String(event.runId ?? runId),
    line,
    source,
    sourceLine,
    type: String(event.type ?? ''),
    kind: String(event.kind ?? ''),
    title: String(event.title ?? ''),
    text: String(event.text ?? ''),
    status: String(event.status ?? ''),
    itemId: String(event.itemId ?? ''),
    tool: String(event.tool ?? ''),
    output: String(event.output ?? ''),
    exitCode: String(event.exitCode ?? ''),
    severity: event.severity === 'error' ? 'error' : event.severity === 'warning' ? 'warning' : 'info',
    persist: Boolean(event.persist),
  };
}

function normalizedEvents(value: unknown, runId: string): CardSkillRunEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((event) => normalizedEvent(event, runId)).filter((event): event is CardSkillRunEvent => Boolean(event));
}

function unavailableSummary(runId: string, since: number, error: string): CardSkillRunSummary {
  return {
    ok: false,
    active: false,
    runId,
    runKind: 'unknown',
    pipelineRunId: '',
    pipelineName: '',
    pipelineStepName: '',
    skillName: '',
    pipelineStatus: '',
    status: 'unknown',
    startedAt: '',
    elapsedMs: 0,
    lineCount: since,
    nextSince: since,
    toolCallCount: 0,
    agentMessageCount: 0,
    fileChangeCount: 0,
    thinkingCount: 0,
    warningCount: 0,
    errorCount: 0,
    transportStatus: 'unknown',
    persistedEventCount: 0,
    metadata: emptyMetadata,
    latestEvent: null,
    events: [],
    diagnostics: [],
    error,
  };
}

export async function requestCardSkillRunStatus(input: { projectId?: string; ledgerId: string; cardId: string; runId: string; since?: number; traceId?: string }): Promise<CardSkillRunSummary> {
  const since = Math.max(0, Number(input.since ?? 0) || 0);
  const params = new URLSearchParams({ ledgerId: input.ledgerId, cardId: input.cardId, since: String(since) });
  if (input.traceId) params.set('traceId', input.traceId);
  const requestPath = `/api/codex/skills/runs/${encodeURIComponent(input.runId)}?${params.toString()}`;
  const response = await fetch(projectScopedRequestPath(requestPath, input.projectId)).catch(() => undefined);
  if (!response) return unavailableSummary(input.runId, since, 'Request failed.');
  const body = await response.json().catch(() => ({})) as Partial<CardSkillRunSummary>;
  const runId = String(body.runId ?? input.runId);
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : emptyMetadata;
  const events = normalizedEvents(body.events, runId);
  const diagnostics = normalizedEvents(body.diagnostics, runId);
  return {
    ok: response.ok && body.ok !== false,
    active: body.active === true,
    runId,
    runKind: body.runKind === 'thread' ? 'thread' : body.runKind === 'card' ? 'card' : 'unknown',
    pipelineRunId: String((body as Record<string, unknown>).pipelineRunId ?? ''),
    pipelineName: String((body as Record<string, unknown>).pipelineName ?? ''),
    pipelineStepName: String((body as Record<string, unknown>).pipelineStepName ?? ''),
    skillName: String((body as Record<string, unknown>).skillName ?? ''),
    pipelineStatus: ['running', 'complete', 'failed', 'cancelled', 'unknown'].includes(String((body as Record<string, unknown>).pipelineStatus ?? ''))
      ? String((body as Record<string, unknown>).pipelineStatus) as CardSkillRunStatus
      : '',
    status: body.status ?? 'unknown',
    startedAt: String(body.startedAt ?? ''),
    elapsedMs: Number(body.elapsedMs ?? 0),
    lineCount: Number(body.lineCount ?? 0),
    nextSince: Number(body.nextSince ?? body.lineCount ?? since),
    toolCallCount: Number(body.toolCallCount ?? 0),
    agentMessageCount: Number(body.agentMessageCount ?? 0),
    fileChangeCount: Number(body.fileChangeCount ?? 0),
    thinkingCount: Number(body.thinkingCount ?? 0),
    warningCount: Number(body.warningCount ?? 0),
    errorCount: Number(body.errorCount ?? 0),
    transportStatus: body.transportStatus === 'degraded' ? 'degraded' : body.transportStatus === 'ok' ? 'ok' : 'unknown',
    persistedEventCount: Number(body.persistedEventCount ?? 0),
    metadata: {
      sourceCardTitle: String(metadata.sourceCardTitle ?? ''),
      sourceThreadId: String(metadata.sourceThreadId ?? ''),
      codexModel: String(metadata.codexModel ?? ''),
      codexEffort: String(metadata.codexEffort ?? ''),
    },
    latestEvent: normalizedEvent(body.latestEvent, runId),
    events,
    diagnostics,
    error: String(body.error ?? ''),
  };
}
