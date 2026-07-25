/**
 * WHAT: Builds one execution-addressed Codex Log snapshot from private JSONL and diagnostic artifacts.
 * WHY: Clients need structured presentation data without raw tool results, file coordinates, and session-latest inference.
 */
import { existsSync, readFileSync } from 'node:fs';
import type {
  TaskExecutionPresentation,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { normalizeCardSkillRunEvent } from './normalize-card-skill-run-event.js';
import { readCardSkillRunEventLines } from './read-card-skill-run-event-lines.js';
import { codexRunExecutionLog, codexRunExecutions } from './codex-run-segment-marker.js';
import type { NormalizedRunEvent } from './card-skill-run-event-types.js';
import { taskExecutionNodeId, taskExecutionProcess } from './task-execution-runtime.js';
import { taskExecutionPresentationDiagnostics } from './task-execution-presentation-diagnostics.js';
import { taskExecutionPresentationEvents } from './task-execution-presentation-events.js';

type AnyRecord = Record<string, unknown>;
type ExecutionRecord = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;
type PresentationTaskState = Pick<ProjectTaskState, 'executions'>;

const terminalPhases = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

function executionEvents(input: {
  execution: ExecutionRecord;
  sessionExecutions: ExecutionRecord[];
  stderrLog: string;
  events: NormalizedRunEvent[];
}): { ok: true; events: NormalizedRunEvent[] } | { ok: false; error: string } {
  const markers = codexRunExecutions({
    log: input.stderrLog,
    runId: input.execution.metadata.sessionId,
  });
  const markerIndex = markers.findIndex((marker) => marker.executionId === input.execution.metadata.executionId);
  if (markerIndex < 0) {
    // WHAT: Represent an admitted execution with no artifact bytes as an empty presentation.
    // WHY: A queued continuation is selected before its process writes the first segment marker.
    if (input.events.length === 0 && !input.stderrLog) return { ok: true, events: [] };
    // WHAT: Admit markerless history only when one execution owns the entire artifact.
    // WHY: Merging an ambiguous multi-execution session would display another execution's output.
    if (input.sessionExecutions.length === 1) return { ok: true, events: input.events };
    return { ok: false, error: 'execution_presentation_boundary_unavailable' };
  }
  const startLine = markers[markerIndex].startLine;
  const endLine = markers[markerIndex + 1]?.startLine ?? Number.POSITIVE_INFINITY;
  return {
    ok: true,
    events: input.events.filter((event) => event.line > startLine && event.line <= endLine),
  };
}

export function buildTaskExecutionPresentation(input: {
  executionId: string;
  state: PresentationTaskState;
  runtime: AnyRecord;
}): { ok: true; presentation: TaskExecutionPresentation } | { ok: false; statusCode: number; error: string } {
  const execution = input.state.executions.find(input.executionId);
  if (!execution) return { ok: false, statusCode: 404, error: 'task_execution_not_found' };
  const terminal = terminalPhases.has(execution.lifecycle.phase);
  if (execution.lifecycle.executorNodeId !== taskExecutionNodeId(input.runtime)
    && !(terminal && typeof input.runtime.taskExecutionArtifactFile === 'function')) {
    return { ok: false, statusCode: 409, error: 'task_execution_wrong_executor' };
  }
  const process = taskExecutionProcess(input.runtime, execution.metadata.executionId);
  const artifactFile = typeof input.runtime.taskExecutionArtifactFile === 'function'
    ? input.runtime.taskExecutionArtifactFile as (hash: string) => string
    : () => '';
  const jsonlFile = process?.stdoutFile || (execution.artifacts.jsonl ? artifactFile(execution.artifacts.jsonl.hash) : '');
  const stderrFile = process?.stderrFile || (execution.artifacts.stderr ? artifactFile(execution.artifacts.stderr.hash) : '');
  const stderrLog = stderrFile && existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
  const normalized = jsonlFile && existsSync(jsonlFile)
    ? readCardSkillRunEventLines(jsonlFile).map(normalizeCardSkillRunEvent)
    : [];
  const sessionExecutions = input.state.executions.bySessionId(execution.metadata.sessionId);
  const selected = executionEvents({ execution, sessionExecutions, stderrLog, events: normalized });
  if ('error' in selected) return { ok: false, statusCode: 409, error: selected.error };
  const selectedDiagnosticLog = codexRunExecutionLog({
    log: stderrLog,
    runId: execution.metadata.sessionId,
    executionId: execution.metadata.executionId,
  });
  // WHAT: Append actionable diagnostics after the selected JSONL segment.
  // WHY: Transport and executor failures remain visible without exposing marker records.
  const events = taskExecutionPresentationEvents([
    ...selected.events,
    ...taskExecutionPresentationDiagnostics(selectedDiagnosticLog),
  ]);
  const counts = {
    tools: events.filter((event) => event.kind === 'tool_call').length,
    messages: events.filter((event) => event.kind === 'agent_message').length,
    comments: events.filter((event) => event.kind === 'comment').length,
    thinking: events.filter((event) => event.kind === 'thinking').length,
    files: events.filter((event) => event.kind === 'file_change').length,
    warnings: events.filter((event) => event.kind === 'warning').length,
    errors: events.filter((event) => event.kind === 'error').length,
  };
  return {
    ok: true,
    presentation: {
      execution: {
        executionId: execution.metadata.executionId,
        sessionId: execution.metadata.sessionId,
        taskId: execution.metadata.taskId,
        kind: execution.metadata.kind,
        phase: execution.lifecycle.phase,
        requestedAt: execution.metadata.requestedAt,
        startedAt: execution.lifecycle.startedAt,
        finishedAt: execution.lifecycle.finishedAt,
        model: execution.metadata.model,
        effort: execution.metadata.effort,
        executorNodeId: execution.lifecycle.executorNodeId,
        revision: execution.lifecycle.revision,
        error: execution.lifecycle.error,
        counts,
      },
      events,
    },
  };
}
