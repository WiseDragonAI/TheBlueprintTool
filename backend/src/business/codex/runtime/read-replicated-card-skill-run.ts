/**
 * WHAT: Reads one remotely executed card-skill run from durable execution state and presentation events.
 * WHY: Project HTTP wiring should delegate replicated presentation assembly to the Codex runtime boundary.
 */
import { replicatedCardSkillRunStatus } from '../helper/replicated-card-skill-run-status.js';
import { taskExecutionState } from '../helper/task-execution-runtime.js';
import type { createTaskExecutionPresentationRegistry } from './task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;

export function readReplicatedCardSkillRun(input: {
  cardId: string;
  executionPresentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  ledgerId: string;
  localNodeId: string;
  runId: string;
  runtime: AnyRecord;
}) {
  const state = taskExecutionState(input.runtime);
  const execution = state?.executions.bySessionId(input.runId)
    .filter((record) => record.metadata.ledgerId === input.ledgerId && (
      record.metadata.sourceCardId === input.cardId
      || record.metadata.ownerCardId === input.cardId
    ))
    .sort((left, right) => (
      right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
      || right.metadata.executionId.localeCompare(left.metadata.executionId)
    ))[0] ?? null;
  if (!execution || execution.lifecycle.executorNodeId === input.localNodeId) return null;
  const events = input.executionPresentations.events(
    execution.metadata.projectId,
    execution.metadata.executionId,
    execution.lifecycle.executorNodeId,
  );
  const hydratedEvents = events.length > 0
    ? events
    : (state
      ? input.executionPresentations.locallyHydrated(state, execution)?.events
      : undefined) ?? [];
  return replicatedCardSkillRunStatus({
    runId: input.runId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    executions: state?.executions.all() ?? [],
    events: hydratedEvents,
    queuePosition: null,
  });
}
