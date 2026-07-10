/**
 * WHAT: Creates or updates one reusable Codex pipeline and its saved step definitions.
 * WHY: Editors should submit typed definitions without constructing persistence routes themselves.
 */
import type {
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

export type CodexPipelineDraft = Omit<CodexPipeline, 'createdAt' | 'updatedAt'> & Partial<Pick<CodexPipeline, 'createdAt' | 'updatedAt'>>;
export type CodexPipelineStepDraft = Omit<CodexPipelineStep, 'createdAt' | 'updatedAt'> & Partial<Pick<CodexPipelineStep, 'createdAt' | 'updatedAt'>>;

export type CodexPipelineSaveRequest = {
  operation?: 'create' | 'update';
  pipelineId?: string;
  pipeline: CodexPipelineDraft;
  steps: readonly CodexPipelineStepDraft[];
};

export type CodexPipelineSaveResult = {
  ok: boolean;
  statusCode: number;
  pipeline?: CodexPipeline;
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  hasInvalidReferences: boolean;
  invalidReferences: readonly CodexPipelineInvalidReference[];
  issues: readonly CodexPipelineStoreIssue[];
  error?: string;
};

type PipelineSaveResponse = Partial<CodexPipelineSaveResult> & {
  pipeline?: CodexPipeline;
  pipelines?: CodexPipeline[];
  steps?: CodexPipelineStep[];
  invalidReferences?: CodexPipelineInvalidReference[];
  issues?: CodexPipelineStoreIssue[];
};

function unavailableSave(error: string, statusCode = 0): CodexPipelineSaveResult {
  return {
    ok: false,
    statusCode,
    pipelines: [],
    steps: [],
    hasInvalidReferences: false,
    invalidReferences: [],
    issues: [],
    error,
  };
}

export async function requestCodexPipelineSave(input: CodexPipelineSaveRequest): Promise<CodexPipelineSaveResult> {
  const operation = input.operation ?? (input.pipelineId ? 'update' : 'create');
  const pipelineId = String(input.pipelineId ?? input.pipeline.id).trim();
  const endpoint = operation === 'update'
    ? `/api/codex/pipelines/${encodeURIComponent(pipelineId)}`
    : '/api/codex/pipelines';
  const response = await fetch(endpoint, {
    method: operation === 'update' ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pipeline: input.pipeline, steps: input.steps }),
  }).catch(() => undefined);
  if (!response) return unavailableSave('Request failed.');
  const body = await response.json().catch(() => null) as PipelineSaveResponse | null;
  if (!body) return unavailableSave('Invalid response.', response.status);
  const invalidReferences = Array.isArray(body.invalidReferences) ? body.invalidReferences : [];
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    pipeline: body.pipeline,
    pipelines: Array.isArray(body.pipelines) ? body.pipelines : [],
    steps: Array.isArray(body.steps) ? body.steps : [],
    hasInvalidReferences: typeof body.hasInvalidReferences === 'boolean'
      ? body.hasInvalidReferences
      : invalidReferences.length > 0,
    invalidReferences,
    issues: Array.isArray(body.issues) ? body.issues : [],
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
