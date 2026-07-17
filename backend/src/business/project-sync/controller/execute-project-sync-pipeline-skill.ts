import { resolve } from 'node:path';
import { executePipelineSkillInWorkspace } from '../../codex/helper/codex-pipeline-runner.js';
import type { ProjectSyncRole } from '../helper/project-sync-types.js';
import type { RepositorySyncStatus } from '../helper/repository-sync-status.js';

const skillForRole: Record<ProjectSyncRole, string> = {
  'source-publisher': 'project-sync-source-publisher',
  'initiator-reconciler': 'project-sync-initiator-reconciler',
  'source-finalizer': 'project-sync-source-finalizer',
};

export function executeProjectSyncPipelineSkill(input: {
  projectRoot: string;
  runtime: Record<string, unknown>;
  ledgerFile: string;
  syncId: string;
  nodeId: string;
  initiatorNodeId: string;
  role: ProjectSyncRole;
  requiredSha?: string;
  snapshot: RepositorySyncStatus;
  codexRunId: string;
  pipelineRunId: string;
  masterTask: { projectId: string; ledgerId: string; cardId: string };
}): Promise<{ codexRunId: string; result: Record<string, unknown> }> {
  return executePipelineSkillInWorkspace({
    workspaceRoot: input.projectRoot,
    decisionOsRoot: resolve(input.projectRoot, '.decision-os'),
    runtime: input.runtime,
    skillName: skillForRole[input.role],
    skillRunId: input.codexRunId,
    ledgerFile: input.ledgerFile,
    context: {
      syncId: input.syncId,
      nodeId: input.nodeId,
      initiatorNodeId: input.initiatorNodeId,
      role: input.role,
      requiredSha: input.requiredSha ?? '',
      snapshot: input.snapshot,
      pipelineRunId: input.pipelineRunId,
      masterTask: input.masterTask,
    },
  });
}
