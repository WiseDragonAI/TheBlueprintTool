/**
 * WHAT: Renders the selected execution's latest typed todo snapshot as a sticky Codex Log overlay.
 * WHY: Execution work state must remain visible while chronological messages scroll underneath it.
 */
import type { TaskExecutionTodoEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';

export function renderTaskExecutionTodoOverlay(todo: TaskExecutionTodoEvent): HTMLElement {
  const overlay = document.createElement('section');
  overlay.className = 'codex-todo-overlay';
  overlay.setAttribute('aria-label', 'Codex todo list');
  const heading = document.createElement('div');
  heading.className = 'codex-todo-overlay-heading';
  heading.textContent = 'Todo';
  const progress = document.createElement('span');
  progress.textContent = `${todo.items.filter((item) => item.completed).length}/${todo.items.length}`;
  heading.append(progress);
  const list = document.createElement('ol');
  list.className = 'codex-todo-list';
  for (const item of todo.items) {
    const row = document.createElement('li');
    row.className = item.completed ? 'is-completed' : 'is-pending';
    const marker = document.createElement('span');
    marker.className = 'codex-todo-list-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = item.completed ? '✓' : '○';
    const label = document.createElement('span');
    label.textContent = item.text;
    row.append(marker, label);
    list.append(row);
  }
  overlay.append(heading, list);
  return overlay;
}
