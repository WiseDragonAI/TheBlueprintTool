import type { RepositorySyncStatus } from './repository-sync-status.js';

export const projectSyncPhases = ['requested', 'preflight', 'source_publish', 'initiator_reconcile', 'source_finalize', 'complete', 'failed'] as const;
export type ProjectSyncPhase = typeof projectSyncPhases[number];
export type ProjectSyncRole = 'source-publisher' | 'initiator-reconciler' | 'source-finalizer';
export type ProjectSyncPreparationPhase = 'pending' | 'materializing' | 'attached';

export type ProjectSyncEvidence = {
  snapshot?: RepositorySyncStatus;
  role?: ProjectSyncRole;
  requiredSha?: string;
  verifiedSha?: string;
  codexRunId?: string;
  result?: Record<string, unknown>;
};

export type ProjectSyncRun = {
  syncId: string;
  idempotencyKey: string;
  initiatorNodeId: string;
  sourceNodeId: string;
  initiatorProjectId: string;
  sourceProjectId: string;
  sourceProjectName: string;
  sourceProjectColor: string;
  originFingerprint: string;
  taskProjectId: string;
  ledgerId: string;
  masterCardId: string;
  pipelineRunId: string;
  preparationPhase: ProjectSyncPreparationPhase;
  phase: ProjectSyncPhase;
  createdAt: string;
  updatedAt: string;
  evidence: Partial<Record<ProjectSyncPhase, ProjectSyncEvidence>>;
  error: null | { phase: ProjectSyncPhase; message: string; detail?: string };
};
