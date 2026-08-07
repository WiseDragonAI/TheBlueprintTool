/**
 * WHAT: Tracks the accepted Epoch 4 task clock for each responsive project and ledger scope.
 * WHY: Responsive navigation and thread refreshes must reject projections older than a local mutation receipt.
 */
const clocks = new Map();

function scopeKey(scope) {
  return JSON.stringify({
    projectId: String(scope?.projectId || ''),
    ledgerId: String(scope?.ledgerId || ''),
  });
}

function dominates(incoming, installed) {
  return Object.entries(installed).every(([replicaId, counter]) => Number(incoming?.[replicaId] || 0) >= Number(counter));
}

export function acceptResponsiveTaskClock(scope, incoming) {
  if (String(scope?.ledgerId || '') !== 'tasks') return true;
  const key = scopeKey(scope);
  const installed = clocks.get(key) || {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return Object.keys(installed).length === 0;
  if (!dominates(incoming, installed)) return false;
  clocks.set(key, { ...incoming });
  return true;
}

export function clearResponsiveTaskClocksForTest() {
  clocks.clear();
}
