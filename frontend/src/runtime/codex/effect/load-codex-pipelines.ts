/**
 * WHAT: Loads the normalized reusable Codex pipeline library for the active workspace.
 * WHY: Pipeline screens need definitions and invalid-reference diagnostics from one typed request.
 */
import type {
  CodexContentKind,
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { CodexSkillSummary } from './load-codex-skills.js';

export type {
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineSkill,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

export type CodexPipelineContentSummary =
  | (Omit<CodexSkillSummary, 'contentKind' | 'executionVisibility'> & {
      contentKind: Exclude<CodexContentKind, 'pipeline-prompt'>;
      executionVisibility: 'agent';
    })
  | (Omit<CodexSkillSummary, 'contentKind' | 'executionVisibility'> & {
      contentKind: 'pipeline-prompt';
      executionVisibility: 'pipeline-only';
    });

export type CodexPipelineLibraryResult = {
  ok: boolean;
  statusCode: number;
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  availableContent: readonly CodexPipelineContentSummary[];
  empty: boolean;
  hasInvalidReferences: boolean;
  invalidReferences: readonly CodexPipelineInvalidReference[];
  issues: readonly CodexPipelineStoreIssue[];
  error?: string;
};

type PipelineLibraryResponse = Partial<CodexPipelineLibraryResult> & {
  pipelines?: CodexPipeline[];
  steps?: CodexPipelineStep[];
  availableContent?: CodexPipelineContentSummary[];
  invalidReferences?: CodexPipelineInvalidReference[];
  issues?: CodexPipelineStoreIssue[];
};

function unavailableLibrary(error: string, statusCode = 0): CodexPipelineLibraryResult {
  return {
    ok: false,
    statusCode,
    pipelines: [],
    steps: [],
    availableContent: [],
    empty: true,
    hasInvalidReferences: false,
    invalidReferences: [],
    issues: [],
    error,
  };
}

export async function loadCodexPipelines(): Promise<CodexPipelineLibraryResult> {
  const response = await fetch('/api/codex/pipelines').catch(() => undefined);
  if (!response) return unavailableLibrary('Request failed.');
  const body = await response.json().catch(() => null) as PipelineLibraryResponse | null;
  if (!body) return unavailableLibrary('Invalid response.', response.status);
  const pipelines = Array.isArray(body.pipelines) ? body.pipelines : [];
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const availableContent = Array.isArray(body.availableContent) ? body.availableContent : [];
  const invalidReferences = Array.isArray(body.invalidReferences) ? body.invalidReferences : [];
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    pipelines,
    steps,
    availableContent,
    empty: typeof body.empty === 'boolean' ? body.empty : pipelines.length === 0,
    hasInvalidReferences: typeof body.hasInvalidReferences === 'boolean'
      ? body.hasInvalidReferences
      : invalidReferences.length > 0,
    invalidReferences,
    issues,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
