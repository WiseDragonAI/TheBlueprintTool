/**
 * WHAT: Starts one saved Codex pipeline against a source card.
 * WHY: Process-card flows need a typed start contract and actionable backend failures.
 */
import type {
  CodexPipelineInvalidReference,
  CodexPipelineRun,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

export type CodexPipelineRunRequest = {
  ledgerId: string;
  sourceCardId: string;
  pipelineId: string;
};

export type CodexPipelineRunResult = {
  ok: boolean;
  statusCode: number;
  run?: CodexPipelineRun;
  skillRun?: Record<string, unknown> | null;
  invalidReferences: readonly CodexPipelineInvalidReference[];
  activeRunId?: string;
  queuePosition?: number | null;
  maxConcurrentCodexProcesses?: number;
  error?: string;
};

type PipelineRunResponse = Partial<CodexPipelineRunResult> & {
  run?: CodexPipelineRun;
  skillRun?: Record<string, unknown> | null;
  invalidReferences?: CodexPipelineInvalidReference[];
};

export async function requestCodexPipelineRun(input: CodexPipelineRunRequest): Promise<CodexPipelineRunResult> {
  const response = await fetch('/api/codex/pipelines/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, invalidReferences: [], error: 'Request failed.' };
  const body = await response.json().catch(() => null) as PipelineRunResponse | null;
  if (!body) return { ok: false, statusCode: response.status, invalidReferences: [], error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    run: body.run,
    skillRun: body.skillRun,
    invalidReferences: Array.isArray(body.invalidReferences) ? body.invalidReferences : [],
    activeRunId: body.activeRunId,
    queuePosition: Number.isInteger(body.queuePosition) && Number(body.queuePosition) > 0 ? Number(body.queuePosition) : null,
    maxConcurrentCodexProcesses: Number(body.maxConcurrentCodexProcesses) || undefined,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
