/**
 * WHAT: Projects active task-group executions onto their exact source subtask.
 * WHY: Concurrent sibling executions need independent status without duplicating execution state in the card runtime.
 */
import { taskExecutionDisplayStatus } from '../../runtime/codex/helper/task-execution-display-status.js';

export function activeSubtaskExecutions(summary) {
  const activeIds = new Set(Array.isArray(summary?.activeExecutionIds) ? summary.activeExecutionIds.map(String) : []);
  const bySourceCardId = new Map();
  for (const session of Array.isArray(summary?.sessions) ? summary.sessions : []) {
    for (const execution of Array.isArray(session?.executions) ? session.executions : []) {
      if (!activeIds.has(String(execution?.executionId ?? ''))) continue;
      const sourceCardId = String(execution?.sourceCardId ?? '');
      if (sourceCardId) bySourceCardId.set(sourceCardId, execution);
    }
  }
  return bySourceCardId;
}

export function applyMasterSubtaskExecutionState(root, summary) {
  const activeBySource = activeSubtaskExecutions(summary);
  for (const button of root.querySelectorAll('.subtask-row[data-card-id]')) {
    const execution = activeBySource.get(String(button.dataset.cardId ?? ''));
    const status = execution ? taskExecutionDisplayStatus(String(execution.phase ?? '')) : '';
    const label = button.querySelector('small');
    if (status === 'pending' || status === 'running') {
      button.dataset.runStatus = status;
      button.dataset.executionPhase = String(execution.phase);
      if (label) label.textContent = String(execution.phase);
      button.setAttribute('aria-label', `${button.dataset.taskTitle}, ${execution.phase}`);
      continue;
    }
    delete button.dataset.runStatus;
    delete button.dataset.executionPhase;
    if (label) label.textContent = String(button.dataset.taskStatus ?? '');
    button.removeAttribute('aria-label');
  }
}
