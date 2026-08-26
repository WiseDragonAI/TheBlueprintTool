/**
 * WHAT: Resolves one master card ID to its local project and Tasks ledger through the Control Room catalog.
 * WHY: task-graph commands must not require callers to rediscover project and ledger identities.
 */
import type { Result } from '../../../lib/types.js';

type AnyRecord = Record<string, unknown>;
export type MasterTaskOwner = {
  assignedNodeId: string;
  ledgerId: string;
  masterCardId: string;
  projectId: string;
  serverUrl: string;
  subtasks: Array<{ cardId: string; position: number }>;
};

function record(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function resolveMasterTaskOwner(masterCardIdInput: string | undefined): Promise<Result<MasterTaskOwner>> {
  const masterCardId = text(masterCardIdInput);
  const serverUrl = text(process.env.DECISION_OS_SERVER_URL).replace(/\/$/, '');
  // WHAT: reject discovery without the only required task identity.
  // WHY: an empty identity cannot deterministically select a task graph.
  if (!masterCardId) return { ok: false, error: 'A --master-card-id is required.' };
  // WHAT: reject discovery without the running Decision OS address.
  // WHY: project and ledger ownership are server catalog state.
  if (!serverUrl) return { ok: false, error: 'Task graph commands require DECISION_OS_SERVER_URL.' };
  try {
    const response = await fetch(`${serverUrl}/api/control-room?localOnly=1`, {
      signal: AbortSignal.timeout(10_000),
    });
    // WHAT: preserve the catalog failure instead of treating it as an empty project set.
    // WHY: unavailable discovery cannot prove that the requested master is absent.
    if (!response.ok) return { ok: false, error: `Master-task discovery failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as AnyRecord;
    const tasks = Array.isArray(payload.allTasks) ? payload.allTasks.filter(record) : [];
    const matches = tasks.filter((task) => text(task.cardId) === masterCardId && task.masterTask === true);
    // WHAT: reject duplicate local owners for one master identity.
    // WHY: the command cannot safely choose between project repositories.
    if (matches.length > 1) return { ok: false, error: `Master card id is ambiguous: ${masterCardId}` };
    // WHAT: reject an identity absent from the complete local task projection.
    // WHY: mutations and commits require a verified canonical master task.
    if (matches.length === 0) return { ok: false, error: `Master task not found: ${masterCardId}` };
    const task = matches[0];
    const projectId = text(task.projectId);
    const ledgerId = text(task.ledgerId);
    // WHAT: reject an incomplete owner projection.
    // WHY: both route segments are required for a scoped task operation.
    if (!projectId || !ledgerId) return { ok: false, error: `Master task owner is incomplete: ${masterCardId}` };
    const projects = Array.isArray(payload.projects) ? payload.projects.filter(record) : [];
    const project = projects.find((entry) => text(entry.id) === projectId);
    const assignedNodeId = text(task.assignedNodeId) || text(project?.ownerNodeId);
    if (!assignedNodeId) return { ok: false, error: `Master task assignment is unavailable: ${masterCardId}` };
    return {
      ok: true,
      value: {
        assignedNodeId,
        ledgerId,
        masterCardId,
        projectId,
        serverUrl,
        subtasks: Array.isArray(task.subtasks)
          ? task.subtasks.filter(record).map((subtask) => ({
              cardId: text(subtask.cardId),
              position: Number(subtask.position),
            })).filter((subtask) => subtask.cardId && Number.isInteger(subtask.position) && subtask.position >= 0)
          : [],
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task discovery failed.' };
  }
}
