/**
 * WHAT: Builds one execution-addressed Codex Log snapshot from private JSONL and diagnostic artifacts.
 * WHY: Clients need structured presentation data without raw tool results, file coordinates, and session-latest inference.
 */
import { existsSync, readFileSync } from 'node:fs';
import type {
  TaskExecutionFileEvent,
  TaskExecutionPresentation,
  TaskExecutionPresentationEvent,
  TaskExecutionTodoItem,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { normalizeCardSkillRunDiagnostic, normalizeCardSkillRunEvent } from './normalize-card-skill-run-event.js';
import { readCardSkillRunEventLines } from './read-card-skill-run-event-lines.js';
import { codexRunExecutionLog, codexRunExecutions, isCodexRunMarkerLine } from './codex-run-segment-marker.js';
import type { NormalizedRunEvent } from './card-skill-run-event-types.js';
import { taskExecutionNodeId, taskExecutionProcess } from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;
type ExecutionRecord = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;
type PresentationTaskState = Pick<ProjectTaskState, 'executions'>;

const terminalPhases = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

function actionableDiagnosticLog(log: string): string {
  // WHAT: Remove private execution markers before converting stderr records to presentation events.
  // WHY: Marker JSON contains artifact segmentation details that must not reach the browser.
  return log.replace(/\r\n?/g, '\n').split('\n').filter((line) => !isCodexRunMarkerLine(line)).join('\n');
}

function normalizedDiagnostics(log: string): NormalizedRunEvent[] {
  const lines = actionableDiagnosticLog(log).split('\n');
  const diagnostics: NormalizedRunEvent[] = [];
  const structuredStart = /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/;
  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const startLine = index + 1;
    const record = [lines[index++]];
    if (structuredStart.test(record[0])) {
      while (index < lines.length && !structuredStart.test(lines[index])) record.push(lines[index++]);
    }
    while (record.at(-1)?.trim() === '') record.pop();
    diagnostics.push(normalizeCardSkillRunDiagnostic({ line: startLine, text: record.join('\n') }));
  }
  return diagnostics;
}

function todoItems(output: string): TaskExecutionTodoItem[] {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return [];
    // WHAT: Validate producer todo entries at the backend presentation boundary.
    // WHY: The overlay must never depend on parsing arbitrary JSON inside the browser.
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const value = entry as AnyRecord;
      const text = String(value.text ?? '').trim();
      return text ? [{ text, completed: value.completed === true }] : [];
    });
  } catch {
    return [];
  }
}

function fileItems(event: NormalizedRunEvent): TaskExecutionFileEvent['files'] {
  // WHAT: Preserve only relative path and action summaries emitted by the existing normalizer.
  // WHY: File contents and absolute artifact paths are not Codex Log presentation data.
  return (event.tool || event.text).split('\n').flatMap((line) => {
    const match = line.trim().match(/^-\s*(.+?):\s*(.+)$/);
    return match ? [{ path: match[1], action: match[2] }] : [];
  });
}

function presentationId(event: NormalizedRunEvent, index: number): string {
  // WHAT: Generate a stable logical identity without exposing physical line positions.
  // WHY: Full snapshot replacement needs DOM keys, not artifact cursors.
  return event.itemId ? `${event.kind}:${event.itemId}` : `${event.kind}:event-${index + 1}`;
}

function presentationEvent(event: NormalizedRunEvent, index: number): TaskExecutionPresentationEvent | null {
  const base = {
    id: presentationId(event, index),
    title: event.title,
    status: event.status,
    severity: event.severity,
  } as const;
  if (event.kind === 'todo_list') {
    const items = todoItems(event.output);
    return items.length > 0 ? { ...base, kind: 'todo_list', items } : null;
  }
  if (event.kind === 'tool_call' && event.title === 'File changes') {
    return { ...base, kind: 'file_change', files: fileItems(event) };
  }
  if (event.kind === 'tool_call') {
    // WHAT: Keep tool identity and settlement metadata while dropping result bodies.
    // WHY: Raw stdout, stderr, aggregated output, and duplicated fenced text caused the multi-megabyte response.
    return {
      ...base,
      kind: 'tool_call',
      command: event.tool || event.title,
      exitCode: event.exitCode,
    };
  }
  const kind = ['agent_message', 'comment', 'thinking', 'warning', 'error', 'transport', 'diagnostic', 'run_status'].includes(event.kind)
    ? event.kind as 'agent_message' | 'comment' | 'thinking' | 'warning' | 'error' | 'transport' | 'diagnostic' | 'run_status'
    : 'diagnostic';
  return event.text ? { ...base, kind, text: event.text } : null;
}

function coalescedPresentation(events: NormalizedRunEvent[]): TaskExecutionPresentationEvent[] {
  const presented: TaskExecutionPresentationEvent[] = [];
  const lifecycleIndexes = new Map<string, number>();
  for (const [index, event] of events.entries()) {
    const item = presentationEvent(event, index);
    if (!item) continue;
    const lifecycleKey = event.itemId && (item.kind === 'tool_call' || item.kind === 'file_change' || item.kind === 'todo_list')
      ? `${item.kind}:${event.itemId}`
      : '';
    // WHAT: Replace lifecycle updates in their original chronological position.
    // WHY: Started, updated, and completed records describe one operator-visible tool or todo snapshot.
    const existingIndex = lifecycleKey ? lifecycleIndexes.get(lifecycleKey) : undefined;
    if (existingIndex !== undefined) presented[existingIndex] = item;
    else {
      if (lifecycleKey) lifecycleIndexes.set(lifecycleKey, presented.length);
      presented.push(item);
    }
  }
  return presented;
}

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
  const events = coalescedPresentation([...selected.events, ...normalizedDiagnostics(selectedDiagnosticLog)]);
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
