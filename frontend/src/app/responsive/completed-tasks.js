/**
 * WHAT: Derives the visible completed-task catalog from the Control Room projection.
 * WHY: Search and filter behavior must remain deterministic across responsive layouts.
 */

export function completedTaskLabels(tasks) {
  return [...new Set(tasks.flatMap((task) => Array.isArray(task?.labels) ? task.labels.map(String) : []))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function filterCompletedTasks(tasks, { query = '', projectIds = [], label = 'All' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const selectedProjects = new Set(projectIds.map(String));
  return tasks.filter((task) => {
    const labels = Array.isArray(task?.labels) ? task.labels.map(String) : [];
    if (selectedProjects.size > 0 && !selectedProjects.has(String(task?.projectId))) return false;
    if (label !== 'All' && !labels.includes(label)) return false;
    if (!normalizedQuery) return true;
    return [task?.title, task?.projectName, task?.ledgerTitle, task?.ledger, ...labels]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery));
  });
}
