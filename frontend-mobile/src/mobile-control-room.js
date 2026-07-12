const COMPLETE_STATUS = 'done';

function normalizedTaskState(card) {
  if (card?.status === COMPLETE_STATUS) return 'complete';
  return card?.taskState === 'active' ? 'active' : 'waiting';
}

export function taskFromCard({ card, ledgerId, ledgerTitle, cards = [] }) {
  const masterTask = card?.cardType === 'master-task';
  const waitingSince = String(card?.taskWaitingSince ?? '');
  const activeSince = String(card?.taskActiveSince ?? '');
  const queueRank = Number.isInteger(card?.taskQueueRank) && card.taskQueueRank > 0 ? card.taskQueueRank : null;
  const subtaskIds = Array.isArray(card?.subtaskIds) ? card.subtaskIds.map(String) : [];
  const subtasks = subtaskIds.map((cardId) => {
    const linked = cards.find((candidate) => String(candidate.id) === cardId);
    return {
      cardId,
      title: String(linked?.title ?? `Card ${cardId}`),
      status: linked?.status === COMPLETE_STATUS ? 'complete' : 'waiting'
    };
  });
  const status = normalizedTaskState(card);
  const diagnostics = [];
  if (masterTask && !Number.isFinite(Date.parse(waitingSince))) diagnostics.push('invalid taskWaitingSince');
  if (masterTask && status === 'active' && !Number.isFinite(Date.parse(activeSince))) diagnostics.push('invalid taskActiveSince');
  return {
    valid: masterTask && diagnostics.length === 0,
    masterTask,
    diagnostics,
    cardId: String(card?.id ?? ''),
    title: String(card?.title || `Card ${card?.id ?? ''}`),
    ledgerId: String(ledgerId),
    ledgerTitle: String(ledgerTitle),
    ledger: String(ledgerTitle),
    status,
    waitingSince,
    waitingTime: Date.parse(waitingSince),
    activeSince,
    activeTime: Date.parse(activeSince),
    queueRank,
    subtasks,
    complete: subtasks.filter((task) => task.status === 'complete').length,
    nextSubtask: subtasks.find((task) => task.status !== 'complete') ?? null,
    card
  };
}

export function deriveControlRoom(entries) {
  const parsed = entries.map(taskFromCard);
  const eligible = parsed.filter((task) => task.valid && task.status !== 'complete');
  const compare = (left, right) => {
    if (left.queueRank !== null || right.queueRank !== null) {
      if (left.queueRank === null) return 1;
      if (right.queueRank === null) return -1;
      if (left.queueRank !== right.queueRank) return left.queueRank - right.queueRank;
    }
    return left.waitingTime - right.waitingTime || left.cardId.localeCompare(right.cardId);
  };
  return {
    queue: eligible.filter((task) => task.status === 'waiting').sort(compare),
    active: eligible.filter((task) => task.status === 'active').sort(compare),
    ledgers: Array.from(new Set(eligible.map((task) => task.ledger))).sort((a, b) => a.localeCompare(b)),
    diagnostics: parsed.filter((task) => !task.valid && task.masterTask)
  };
}

export function waitingAge(timestamp, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(timestamp));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

export function activeAge(timestamp, now = Date.now()) {
  return waitingAge(timestamp, now).replace(/ waiting$/, ' active');
}
