/**
 * WHAT: Renders dynamically queued skill executions as a persistent subagent inventory.
 * WHY: The gate's child work must remain visible while its chronological log scrolls.
 */
import type {
  TaskExecutionStateItem,
  TaskExecutionSubagentEvent,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { taskExecutionDisplayStatus } from '../../codex/helper/task-execution-display-status.js';

export type TaskExecutionSubagentInventoryItem = {
  readonly event: TaskExecutionSubagentEvent;
  readonly execution: TaskExecutionStateItem | null;
};

export function renderTaskExecutionSubagentOverlay(items: readonly TaskExecutionSubagentInventoryItem[]): HTMLElement {
  const overlay = document.createElement('section');
  overlay.className = 'codex-subagent-overlay';
  overlay.setAttribute('aria-label', 'Codex subagents');
  const heading = document.createElement('div');
  heading.className = 'codex-subagent-overlay-heading';
  heading.textContent = 'Subagents';
  const settled = items.filter(({ execution, event }) => {
    const status = execution ? taskExecutionDisplayStatus(execution.phase) : event.status;
    return /complete|failed|cancel/i.test(status);
  }).length;
  const progress = document.createElement('span');
  progress.textContent = `${settled}/${items.length} settled`;
  heading.append(progress);
  const list = document.createElement('ol');
  list.className = 'codex-subagent-list';
  for (const { event, execution } of items) {
    const status = execution ? taskExecutionDisplayStatus(execution.phase) : event.status || 'queued';
    const row = document.createElement('li');
    row.dataset.runStatus = status;
    const identity = document.createElement('strong');
    identity.textContent = event.skillName;
    const configuration = document.createElement('span');
    configuration.textContent = [event.model, event.effort].filter(Boolean).join(' · ');
    const phase = document.createElement('span');
    phase.className = 'codex-subagent-status';
    phase.textContent = status;
    row.append(identity, configuration, phase);
    list.append(row);
  }
  overlay.append(heading, list);
  return overlay;
}
