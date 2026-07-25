/**
 * WHAT: Defines the task and compatibility-session identity consumed by Codex Log bindings.
 * WHY: The task presentation poller and session mutation consumer share one caller contract.
 */
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';

export type ThreadCodexRunLogIdentity = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  cardId: string;
  threadId: string;
  runId: string;
  expectedExecutionId?: string;
  expectedStatus?: CardSkillRunSummary['status'];
  forceRevalidate?: boolean;
};
