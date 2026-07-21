/**
 * WHAT: Projects responsive task presentation from structural card and relationship state.
 * WHY: Narrative Markdown and node-local observations cannot classify tasks or override replicated lifecycle state.
 */
export function cardCodexRunId(card) {
  return String(card?.codexActiveRunId ?? '').trim()
    || String(card?.codexThreadRunId ?? '').trim()
    || String(card?.codexRunId ?? '').trim();
}

export function projectMasterTask({ card, cards = [], relationships = [], ledgerTitle = '' }) {
  const labels = Array.isArray(card?.labels) ? card.labels.map(String) : [];
  const masterTask = labels.includes('master-task');
  const lifecycle = card?.lifecycle && typeof card.lifecycle === 'object' ? card.lifecycle : {};
  const executionIntent = card?.executionIntent && typeof card.executionIntent === 'object' ? card.executionIntent : {};
  const executionActive = ['waiting', 'queued', 'running'].includes(String(executionIntent.state ?? ''));
  const orderedRelationships = relationships
    .filter((entry) => String(entry?.from) === String(card?.id) && entry?.label === 'subtask')
    .sort((left, right) => Number(left.position) - Number(right.position) || String(left.id).localeCompare(String(right.id)));
  const subtasks = orderedRelationships.map((relationship) => {
    const linked = cards.find((candidate) => String(candidate?.id) === String(relationship.to));
    return {
      title: String(linked?.title || `Card ${relationship.to}`),
      cardId: String(relationship.to),
      relationshipId: String(relationship.id),
      position: Number(relationship.position),
      status: linked?.lifecycle?.status === 'done' ? 'complete' : 'waiting'
    };
  });
  const complete = subtasks.filter((task) => task.status === 'complete').length;
  const lifecycleStatus = String(lifecycle.status ?? '');
  return {
    valid: masterTask && ['todo', 'backlog', 'done'].includes(lifecycleStatus),
    masterTask,
    cardId: String(card?.id ?? ''),
    title: String(card?.title || `Card ${card?.id ?? ''}`),
    ledger: String(ledgerTitle),
    status: executionActive ? 'task-execution' : lifecycleStatus === 'backlog' ? 'task-backlog' : lifecycleStatus === 'done' ? 'task-complete' : 'task-waiting',
    executionStatus: executionActive ? String(executionIntent.state) : '',
    waitingSince: String(lifecycle.waitingAt ?? ''),
    completedAt: String(lifecycle.closedAt ?? ''),
    subtasks,
    complete,
    nextSubtask: subtasks.find((task) => task.status !== 'complete') ?? null
  };
}

export function compareControlRoomQueueTasks(left, right) {
  const leftTime = Number.isFinite(left.waitingTime) ? left.waitingTime : Number.NEGATIVE_INFINITY;
  const rightTime = Number.isFinite(right.waitingTime) ? right.waitingTime : Number.NEGATIVE_INFINITY;
  return rightTime - leftTime
    || String(left.projectId ?? '').localeCompare(String(right.projectId ?? ''))
    || String(left.ledgerId ?? '').localeCompare(String(right.ledgerId ?? ''))
    || String(left.cardId ?? '').localeCompare(String(right.cardId ?? ''));
}

export function waitingAge(timestamp, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(timestamp));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

export function executionAge(timestamp, now = Date.now()) {
  return waitingAge(timestamp, now).replace(/ waiting$/, ' executing');
}

export function executionStopwatch(timestamp, now = Date.now()) {
  const elapsedSeconds = Math.floor(Math.max(0, now - Date.parse(timestamp)) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
