/**
 * WHAT: Defines durable saved-pipeline, pipeline-run, and skill-library records.
 * WHY: Backend persistence and frontend pipeline tooling must share one path-free contract.
 */

export const codexPipelineStoreVersion = 1 as const;

export const codexModelOptions = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.2',
] as const;

export const codexEffortOptions = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;

export type CodexModel = typeof codexModelOptions[number];
export type CodexEffort = typeof codexEffortOptions[number];

export type CodexPipelineStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';

export type CodexPipelineSkill = {
  readonly id: string;
  readonly skillName: string;
  readonly codexModel: CodexModel | null;
  readonly codexEffort: CodexEffort | null;
};

export type CodexPipelineStep = {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly skills: readonly CodexPipelineSkill[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CodexPipeline = {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly stepIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CodexPipelineRunSkill = {
  readonly id: string;
  readonly pipelineSkillId: string;
  readonly skillName: string;
  readonly runId: string;
  readonly status: CodexPipelineStatus;
  readonly codexModel: CodexModel | string;
  readonly codexEffort: CodexEffort | string;
  readonly stdoutFile: string;
  readonly stderrFile: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: string;
};

export type CodexPipelineRunStep = {
  readonly id: string;
  readonly stepId: string;
  readonly name: string;
  readonly purpose: string;
  readonly outputCardId: string;
  readonly status: CodexPipelineStatus;
  readonly skills: readonly CodexPipelineRunSkill[];
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: string;
};

export type CodexPipelineRun = {
  readonly id: string;
  readonly pipelineId: string | null;
  readonly pipelineName: string;
  readonly temporary: boolean;
  readonly ledgerId: string;
  readonly sourceCardId: string;
  readonly sourceCardTitle: string;
  readonly status: CodexPipelineStatus;
  readonly steps: readonly CodexPipelineRunStep[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly resumedAt: string | null;
  readonly error: string;
};

export type CodexSkillLibraryRecord = {
  readonly skillName: string;
  readonly favorite: boolean;
  readonly defaultCodexModel: CodexModel | null;
  readonly defaultCodexEffort: CodexEffort | null;
  readonly updatedAt: string;
};

export type CodexPipelineStore = {
  readonly version: typeof codexPipelineStoreVersion;
  readonly pipelines: readonly CodexPipeline[];
  readonly steps: readonly CodexPipelineStep[];
  readonly runs: readonly CodexPipelineRun[];
  readonly skillLibrary: readonly CodexSkillLibraryRecord[];
  readonly activeWorkspaceRun: string | null;
};

export type CodexPipelineInvalidReference = {
  readonly kind: 'step' | 'skill';
  readonly reference: string;
  readonly pipelineId: string;
  readonly stepId: string;
};

export type CodexPipelineStoreIssueCode =
  | 'invalid-store'
  | 'invalid-pipeline-id'
  | 'duplicate-pipeline-id'
  | 'invalid-step-id'
  | 'duplicate-step-id'
  | 'duplicate-step-skill-id'
  | 'invalid-step-reference'
  | 'invalid-skill-reference'
  | 'unsupported-pipeline-skill-model'
  | 'unsupported-pipeline-skill-effort'
  | 'invalid-run-id'
  | 'duplicate-run-id'
  | 'empty-skill-library-name'
  | 'duplicate-skill-library-name'
  | 'unsupported-default-model'
  | 'unsupported-default-effort'
  | 'stale-skill-library-record'
  | 'invalid-active-workspace-run';

export type CodexPipelineStoreIssue = {
  readonly code: CodexPipelineStoreIssueCode;
  readonly message: string;
  readonly pipelineId?: string;
  readonly stepId?: string;
  readonly skillId?: string;
  readonly skillName?: string;
  readonly runId?: string;
};

export type CodexPipelineStoreNormalization = {
  readonly store: CodexPipelineStore;
  readonly invalidReferences: readonly CodexPipelineInvalidReference[];
  readonly issues: readonly CodexPipelineStoreIssue[];
};
