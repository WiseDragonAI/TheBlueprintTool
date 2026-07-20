/**
 * WHAT: Derives the visible completed-task catalog from the Control Room projection.
 * WHY: Search and filter behavior must remain deterministic across responsive layouts.
 */

export function completedTaskLabels(tasks) {
  return [...new Set(tasks.flatMap((task) => Array.isArray(task?.labels) ? task.labels.map(String) : []))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function sortCompletedTasks(tasks, order = 'desc') {
  const direction = order === 'asc' ? 1 : -1;
  return tasks.map((task, index) => ({ task, index })).sort((left, right) => {
    const leftTime = Number(left.task?.completedTime);
    const rightTime = Number(right.task?.completedTime);
    const leftKnown = left.task?.completedTime != null && Number.isFinite(leftTime);
    const rightKnown = right.task?.completedTime != null && Number.isFinite(rightTime);
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
    if (leftKnown && leftTime !== rightTime) return (leftTime - rightTime) * direction;
    return left.index - right.index;
  }).map(({ task }) => task);
}

export function filterCompletedTasks(tasks, { query = '', projectIds = [], label = 'All', order = 'desc' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const selectedProjects = new Set(projectIds.map(String));
  const filtered = tasks.filter((task) => {
    const labels = Array.isArray(task?.labels) ? task.labels.map(String) : [];
    if (selectedProjects.size > 0 && !selectedProjects.has(String(task?.projectId))) return false;
    if (label !== 'All' && !labels.includes(label)) return false;
    if (!normalizedQuery) return true;
    return [task?.title, task?.projectName, task?.ledgerTitle, task?.ledger, ...labels]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery));
  });
  return sortCompletedTasks(filtered, order);
}
