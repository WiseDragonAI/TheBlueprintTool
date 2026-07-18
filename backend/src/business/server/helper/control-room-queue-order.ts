/**
 * WHAT: Defines the canonical Control Room Queue order for local and federated projections.
 * WHY: Federation merging must not reintroduce node-grouped ordering after each node builds its local Queue.
 */
type ControlRoomTask = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function waitingTime(value: unknown): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

export function compareControlRoomQueueTasks(left: ControlRoomTask, right: ControlRoomTask): number {
  const leftWaitingTime = waitingTime(left.waitingTime);
  const rightWaitingTime = waitingTime(right.waitingTime);
  if (leftWaitingTime !== null || rightWaitingTime !== null) {
    if (leftWaitingTime === null) return 1;
    if (rightWaitingTime === null) return -1;
    if (leftWaitingTime !== rightWaitingTime) return rightWaitingTime - leftWaitingTime;
  }

  return text(left.projectId).localeCompare(text(right.projectId))
    || text(left.ledgerId).localeCompare(text(right.ledgerId))
    || text(left.cardId).localeCompare(text(right.cardId));
}
