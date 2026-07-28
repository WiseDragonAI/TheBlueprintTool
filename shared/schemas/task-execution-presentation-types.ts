/**
 * WHAT: Defines the lightweight task hierarchy and exact-execution presentation returned to Codex Log clients.
 * WHY: Browsers must consume execution-addressed data without learning artifact layout or receiving raw tool results.
 */
import type { TaskExecutionKind, TaskExecutionPhase } from '../task-current-state-core/model.js';

export type TaskExecutionArtifactAvailability = {
  readonly jsonl: boolean;
  readonly stderr: boolean;
  readonly telemetry: boolean;
  readonly result: boolean;
};

export type TaskExecutionStateItem = {
  readonly executionId: string;
  readonly sessionId: string;
  readonly sourceCardId: string;
  readonly kind: TaskExecutionKind;
  readonly phase: TaskExecutionPhase;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly executorNodeId: string;
  readonly revision: number;
  readonly queuePosition: number | null;
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly artifacts: TaskExecutionArtifactAvailability;
};

export type TaskExecutionStateSession = {
  readonly sessionId: string;
  readonly requestedAt: string;
  readonly executions: readonly TaskExecutionStateItem[];
};

export type TaskExecutionStateSummary = {
  readonly taskId: string;
  readonly activeExecutionIds: readonly string[];
  readonly defaultExecutionId: string | null;
  readonly sessions: readonly TaskExecutionStateSession[];
};

/**
 * WHAT: Carries one native Codex todo item without routing it through a generic output string.
 * WHY: The frontend overlay needs exact completion booleans and ordered labels.
 */
export type TaskExecutionTodoItem = {
  readonly text: string;
  readonly completed: boolean;
};

type TaskExecutionPresentationEventBase = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly severity: 'info' | 'warning' | 'error';
};

export type TaskExecutionTextEvent = TaskExecutionPresentationEventBase & {
  readonly kind: 'agent_message' | 'comment' | 'thinking' | 'warning' | 'error' | 'transport' | 'diagnostic' | 'run_status';
  readonly text: string;
};

export type TaskExecutionToolEvent = TaskExecutionPresentationEventBase & {
  readonly kind: 'tool_call';
  readonly command: string;
  readonly exitCode: string;
};

export type TaskExecutionFileEvent = TaskExecutionPresentationEventBase & {
  readonly kind: 'file_change';
  readonly files: readonly { readonly path: string; readonly action: string }[];
};

export type TaskExecutionTodoEvent = TaskExecutionPresentationEventBase & {
  readonly kind: 'todo_list';
  readonly items: readonly TaskExecutionTodoItem[];
};

/**
 * WHAT: Limits the public log vocabulary to operator-facing presentation records.
 * WHY: Raw producer records and artifact coordinates must stop at the backend parser boundary.
 */
export type TaskExecutionPresentationEvent =
  | TaskExecutionTextEvent
  | TaskExecutionToolEvent
  | TaskExecutionFileEvent
  | TaskExecutionTodoEvent;

export type TaskExecutionPresentationCounts = {
  readonly tools: number;
  readonly messages: number;
  readonly comments: number;
  readonly thinking: number;
  readonly files: number;
  readonly warnings: number;
  readonly errors: number;
};

export type TaskExecutionPresentationMetadata = {
  readonly executionId: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly kind: TaskExecutionKind;
  readonly phase: TaskExecutionPhase;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly executorNodeId: string;
  readonly revision: number;
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly counts: TaskExecutionPresentationCounts;
};

export type TaskExecutionPresentation = {
  readonly execution: TaskExecutionPresentationMetadata;
  readonly events: readonly TaskExecutionPresentationEvent[];
};
