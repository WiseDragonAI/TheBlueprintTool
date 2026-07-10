/**
 * WHAT: Reads and controls one durable Codex pipeline run.
 * WHY: Widgets need one typed contract for persisted detail, cancellation, and restart actions.
 */
import type {
  CodexPipeline,
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineRunStep,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

export type CodexPipelineRunSkillDetail = CodexPipelineRunSkill & {
  stdoutAvailable: boolean;
  stderrAvailable: boolean;
  logAvailable: boolean;
  lastLogWriteAt: string | null;
};

export type CodexPipelineOutputCardDetail = {
  id: string;
  title: string;
  contentAvailable: boolean;
  contentBytes: number;
};

export type CodexPipelineRunStepDetail = Omit<CodexPipelineRunStep, 'skills'> & {
  outputCard: CodexPipelineOutputCardDetail;
  skills: readonly CodexPipelineRunSkillDetail[];
};

export type CodexPipelineRunDetail = Omit<CodexPipelineRun, 'steps'> & {
  steps: readonly CodexPipelineRunStepDetail[];
};

export type CodexPipelineRunStatusResult = {
  ok: boolean;
  statusCode: number;
  run?: CodexPipelineRunDetail;
  pipeline?: CodexPipeline | null;
  activeStep?: CodexPipelineRunStepDetail | null;
  activeSkill?: CodexPipelineRunSkillDetail | null;
  canCancel: boolean;
  canRestart: boolean;
  canContinue: boolean;
  status?: string;
  error?: string;
};

export type CodexPipelineRunRestartResult = {
  ok: boolean;
  statusCode: number;
  run?: CodexPipelineRun;
  skillRun?: Record<string, unknown> | null;
  activeRunId?: string;
  error?: string;
};

type PipelineRunStatusResponse = Partial<CodexPipelineRunStatusResult> & {
  run?: CodexPipelineRunDetail;
  pipeline?: CodexPipeline | null;
  activeStep?: CodexPipelineRunStepDetail | null;
  activeSkill?: CodexPipelineRunSkillDetail | null;
};

type PipelineRunRestartResponse = Partial<CodexPipelineRunRestartResult> & {
  run?: CodexPipelineRun;
  skillRun?: Record<string, unknown> | null;
};

function runEndpoint(runId: string, action = ''): string {
  const suffix = action ? `/${action}` : '';
  return `/api/codex/pipelines/runs/${encodeURIComponent(runId)}${suffix}`;
}

function unavailableStatus(error: string, statusCode = 0): CodexPipelineRunStatusResult {
  return {
    ok: false,
    statusCode,
    canCancel: false,
    canRestart: false,
    canContinue: false,
    error,
  };
}

function normalizeStatus(response: Response, body: PipelineRunStatusResponse): CodexPipelineRunStatusResult {
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    run: body.run,
    pipeline: body.pipeline,
    activeStep: body.activeStep,
    activeSkill: body.activeSkill,
    canCancel: Boolean(body.canCancel),
    canRestart: Boolean(body.canRestart),
    canContinue: Boolean(body.canContinue),
    status: body.status,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}

async function requestPipelineRunStatus(input: { runId: string; action?: 'cancel' }): Promise<CodexPipelineRunStatusResult> {
  const response = await fetch(runEndpoint(input.runId, input.action), input.action ? { method: 'POST' } : undefined)
    .catch(() => undefined);
  if (!response) return unavailableStatus('Request failed.');
  const body = await response.json().catch(() => null) as PipelineRunStatusResponse | null;
  if (!body) return unavailableStatus('Invalid response.', response.status);
  return normalizeStatus(response, body);
}

export function requestCodexPipelineRunStatus(input: { runId: string }): Promise<CodexPipelineRunStatusResult> {
  return requestPipelineRunStatus(input);
}

export function requestCodexPipelineRunCancel(input: { runId: string }): Promise<CodexPipelineRunStatusResult> {
  return requestPipelineRunStatus({ ...input, action: 'cancel' });
}

export async function requestCodexPipelineRunRestart(input: { runId: string }): Promise<CodexPipelineRunRestartResult> {
  const response = await fetch(runEndpoint(input.runId, 'restart'), { method: 'POST' }).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as PipelineRunRestartResponse | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    run: body.run,
    skillRun: body.skillRun,
    activeRunId: body.activeRunId,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
