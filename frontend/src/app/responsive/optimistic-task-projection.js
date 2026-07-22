/** WHAT: Replays pending task mutations over any Control Room projection. */

export function taskIdentity(task) {
  return [task?.projectId, task?.ownerNodeId, task?.ledgerId, task?.cardId]
    .map((part) => encodeURIComponent(String(part ?? '')))
    .join('--');
}

export function taskProjectionStatus(lifecycleStatus) {
  return lifecycleStatus === 'backlog' ? 'task-backlog' : lifecycleStatus === 'done' ? 'task-complete' : 'task-waiting';
}

function taskProjectionCollection(lifecycleStatus) {
  return lifecycleStatus === 'backlog' ? 'backlog' : lifecycleStatus === 'done' ? 'done' : 'queue';
}

export function removeTaskIdentityFromProjection(projection, identity) {
  for (const collection of ['queue', 'exec', 'backlog', 'done', 'allTasks']) {
    projection[collection] = (projection[collection] ?? []).filter((task) => taskIdentity(task) !== identity);
  }
}

export function applyTaskIntentToProjection(projection, identity, intent) {
  removeTaskIdentityFromProjection(projection, identity);
  if (intent.kind === 'delete') return projection;
  const task = {
    ...intent.task,
    cardStatus: intent.lifecycleStatus,
    status: taskProjectionStatus(intent.lifecycleStatus),
  };
  const collection = taskProjectionCollection(intent.lifecycleStatus);
  projection[collection] = [task, ...(projection[collection] ?? [])];
  projection.allTasks = [task, ...(projection.allTasks ?? [])];
  return projection;
}

export function taskIntentConfirmed(intent, serverTask) {
  if (!intent.acknowledged) return false;
  if (intent.kind === 'delete') return !serverTask;
  return serverTask?.cardStatus === intent.lifecycleStatus || serverTask?.status === taskProjectionStatus(intent.lifecycleStatus);
}
