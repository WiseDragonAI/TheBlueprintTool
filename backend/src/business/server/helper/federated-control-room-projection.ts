/**
 * WHAT: Qualifies and merges owner-local Control Room projections into one federation-wide read model.
 * WHY: Project IDs and task rows must remain unambiguous when multiple environments expose equal local project IDs.
 */
import { createHash } from 'node:crypto';
import { compareControlRoomQueueTasks } from './control-room-queue-order.js';

type AnyRecord = Record<string, unknown>;
type Owner = { nodeId: string; nodeLabel: string; remote: boolean; online?: boolean };

export function federatedControlRoomProjection(input: {
  localProjection: AnyRecord;
  localOwner: Owner;
  remoteProjections: Array<{ projection: AnyRecord; owner: Owner }>;
  diagnostics: AnyRecord[];
}): AnyRecord {
  const qualify = (projection: AnyRecord, owner: Owner): AnyRecord => {
    const qualifyTask = (value: unknown): AnyRecord => {
      const task = value && typeof value === 'object' ? value as AnyRecord : {};
      const localProjectId = String(task.projectId ?? '');
      return {
        ...task,
        status: task.status === 'task-active' ? 'task-execution' : task.status,
        executionSince: task.executionSince ?? task.activeSince,
        executionTime: task.executionTime ?? task.activeTime,
        projectId: owner.remote ? `${owner.nodeId}:${localProjectId}` : localProjectId,
        localProjectId,
        ownerNodeId: owner.nodeId,
        ownerNodeLabel: owner.nodeLabel,
        ownerOnline: owner.online !== false,
        remote: owner.remote,
      };
    };
    const list = (key: string, legacyKey = ''): AnyRecord[] => {
      const values = Array.isArray(projection[key]) ? projection[key] : legacyKey && Array.isArray(projection[legacyKey]) ? projection[legacyKey] : [];
      return (values as unknown[]).map(qualifyTask);
    };
    const projects = Array.isArray(projection.projects) ? projection.projects as AnyRecord[] : [];
    return {
      ...projection,
      queue: list('queue'), exec: list('exec', 'active'), backlog: list('backlog'), done: list('done'), allTasks: list('allTasks'),
      diagnostics: Array.isArray(projection.diagnostics) ? projection.diagnostics : [],
      projects: projects.map((project) => ({
        ...project,
        id: owner.remote ? `${owner.nodeId}:${String(project.id ?? '')}` : String(project.id ?? ''),
        localProjectId: String(project.id ?? ''), ownerNodeId: owner.nodeId, ownerNodeLabel: owner.nodeLabel, online: owner.online !== false, remote: owner.remote,
      })),
    };
  };
  const projections = [
    qualify(input.localProjection, input.localOwner),
    ...input.remoteProjections.map(({ projection, owner }) => qualify(projection, owner)),
  ];
  const mergedLists = Object.fromEntries(['queue', 'exec', 'backlog', 'done', 'allTasks'].map((key) => [
    key,
    projections.flatMap((projection) => Array.isArray(projection[key]) ? projection[key] as unknown[] : []),
  ]));
  const fingerprints = projections.map((projection) => String(projection.fingerprint ?? ''));
  mergedLists.queue.sort(compareControlRoomQueueTasks);
  return {
    ...projections[0], ...mergedLists,
    projects: projections.flatMap((projection) => Array.isArray(projection.projects) ? projection.projects as unknown[] : []),
    ledgers: Array.from(new Set(projections.flatMap((projection) => Array.isArray(projection.ledgers) ? projection.ledgers.map(String) : []))).sort(),
    diagnostics: [...projections.flatMap((projection) => Array.isArray(projection.diagnostics) ? projection.diagnostics as AnyRecord[] : []), ...input.diagnostics],
    fingerprint: createHash('sha256').update(JSON.stringify(fingerprints)).digest('hex'),
    federation: { nodeCount: projections.length, remoteNodeCount: projections.length - 1 },
  };
}
