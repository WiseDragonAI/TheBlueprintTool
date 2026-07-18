/**
 * WHAT: Reconciles node-local Control Room projections into logical projects and tasks.
 * WHY: A repository checkout is a replica of one project, not a second owner of every card.
 */
import { createHash } from 'node:crypto';
import { compareControlRoomQueueTasks } from './control-room-queue-order.js';

type AnyRecord = Record<string, unknown>;
type Owner = { nodeId: string; nodeLabel: string; remote: boolean; online?: boolean };

const taskLists = ['queue', 'exec', 'backlog', 'done'] as const;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function logicalProjectKey(project: AnyRecord): string {
  const originFingerprint = text(project.originFingerprint).trim();
  const localProjectId = text(project.localProjectId).trim();
  return originFingerprint && localProjectId
    ? `repository:${originFingerprint}:${localProjectId}`
    : `node:${text(project.ownerNodeId)}:${localProjectId}`;
}

function taskSemanticFingerprint(task: AnyRecord): string {
  const semantic = Object.fromEntries(Object.entries(task).filter(([key]) => ![
    'projectId', 'localProjectId', 'ownerNodeId', 'ownerNodeLabel', 'ownerOnline', 'remote',
    'logicalProjectKey', 'replica', 'replicas', 'replicaCount', 'conflict',
  ].includes(key)));
  return createHash('sha256').update(JSON.stringify(semantic)).digest('hex');
}

function authorityMember(members: AnyRecord[]): AnyRecord {
  return [...members].sort((left, right) => {
    const locality = Number(left.remote === true) - Number(right.remote === true);
    return locality || text(left.ownerNodeId).localeCompare(text(right.ownerNodeId));
  })[0];
}

export function federatedControlRoomProjection(input: {
  localProjection: AnyRecord;
  localOwner: Owner;
  remoteProjections: Array<{ projection: AnyRecord; owner: Owner }>;
  diagnostics: AnyRecord[];
}): AnyRecord {
  const qualify = (projection: AnyRecord, owner: Owner): AnyRecord => {
    const projects = records(projection.projects).map((project) => {
      const localProjectId = text(project.id);
      const qualified = {
        ...project,
        id: owner.remote ? `${owner.nodeId}:${localProjectId}` : localProjectId,
        localProjectId,
        ownerNodeId: owner.nodeId,
        ownerNodeLabel: owner.nodeLabel,
        online: owner.online !== false,
        remote: owner.remote,
      };
      return { ...qualified, logicalProjectKey: logicalProjectKey(qualified) };
    });
    const projectByLocalId = new Map(projects.map((project) => [text(project.localProjectId), project]));
    const qualifyTask = (value: unknown, fallbackStatus = ''): AnyRecord => {
      const task = value && typeof value === 'object' ? value as AnyRecord : {};
      const localProjectId = text(task.projectId);
      const project = projectByLocalId.get(localProjectId);
      return {
        ...task,
        status: task.status === 'task-active' ? 'task-execution' : task.status ?? fallbackStatus,
        executionSince: task.executionSince ?? task.activeSince,
        executionTime: task.executionTime ?? task.activeTime,
        projectId: owner.remote ? `${owner.nodeId}:${localProjectId}` : localProjectId,
        localProjectId,
        logicalProjectKey: project?.logicalProjectKey ?? `node:${owner.nodeId}:${localProjectId}`,
        ownerNodeId: owner.nodeId,
        ownerNodeLabel: owner.nodeLabel,
        ownerOnline: owner.online !== false,
        remote: owner.remote,
      };
    };
    const list = (key: string, legacyKey = ''): AnyRecord[] => {
      const values = records(projection[key]);
      const legacyValues = legacyKey ? records(projection[legacyKey]) : [];
      const fallbackStatus = ({ queue: 'task-waiting', exec: 'task-execution', active: 'task-execution', backlog: 'task-backlog', done: 'task-complete' } as Record<string, string>)[key] ?? '';
      return (values.length ? values : legacyValues).map((value) => qualifyTask(value, fallbackStatus));
    };
    return {
      ...projection,
      queue: list('queue'),
      exec: list('exec', 'active'),
      backlog: list('backlog'),
      done: list('done'),
      allTasks: list('allTasks'),
      diagnostics: records(projection.diagnostics),
      projects,
    };
  };

  const projections = [
    qualify(input.localProjection, input.localOwner),
    ...input.remoteProjections.map(({ projection, owner }) => qualify(projection, owner)),
  ];
  const projectGroups = new Map<string, AnyRecord[]>();
  for (const project of projections.flatMap((projection) => records(projection.projects))) {
    const key = text(project.logicalProjectKey);
    projectGroups.set(key, [...(projectGroups.get(key) ?? []), project]);
  }
  const projectAuthorities = new Map<string, AnyRecord>();
  const projects = [...projectGroups.entries()].map(([key, members]) => {
    const authority = authorityMember(members);
    projectAuthorities.set(key, authority);
    return {
      ...authority,
      logicalProjectKey: key,
      replicaCount: members.length,
      replicas: members.map((member) => ({
        projectId: member.id,
        ownerNodeId: member.ownerNodeId,
        ownerNodeLabel: member.ownerNodeLabel,
        online: member.online,
        remote: member.remote,
      })),
    };
  });

  const sourceTasks = projections.flatMap((projection) => {
    const allTasks = records(projection.allTasks);
    const candidates = allTasks.length ? allTasks : taskLists.flatMap((key) => records(projection[key]));
    const unique = new Map<string, AnyRecord>();
    for (const task of candidates) {
      const key = [task.ownerNodeId, task.projectId, task.ledgerId, task.cardId].map(text).join('\0');
      if (!unique.has(key)) unique.set(key, task);
    }
    return [...unique.values()];
  });
  const taskGroups = new Map<string, AnyRecord[]>();
  for (const task of sourceTasks) {
    const key = [task.logicalProjectKey, task.ledgerId, task.cardId].map(text).join('\0');
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), task]);
  }

  const conflictDiagnostics: AnyRecord[] = [];
  const allTasks: AnyRecord[] = [...taskGroups.values()].map((members): AnyRecord => {
    const projectKey = text(members[0]?.logicalProjectKey);
    const projectAuthority = projectAuthorities.get(projectKey);
    const authority = members.find((member) => member.ownerNodeId === projectAuthority?.ownerNodeId) ?? authorityMember(members);
    const fingerprints = new Set(members.map(taskSemanticFingerprint));
    const conflict = fingerprints.size > 1;
    if (conflict) {
      conflictDiagnostics.push({
        valid: false,
        type: 'federation_task_conflict',
        projectId: authority.projectId,
        localProjectId: authority.localProjectId,
        ledgerId: authority.ledgerId,
        cardId: authority.cardId,
        message: `Task replicas disagree; ${text(authority.ownerNodeLabel) || text(authority.ownerNodeId)} is displayed.`,
      });
    }
    return {
      ...authority,
      conflict,
      replicaCount: members.length,
      replicas: members.map((member) => ({
        projectId: member.projectId,
        ownerNodeId: member.ownerNodeId,
        ownerNodeLabel: member.ownerNodeLabel,
        ownerOnline: member.ownerOnline,
        status: member.status,
      })),
    };
  });
  const mergedLists: Record<string, AnyRecord[]> = {
    queue: allTasks.filter((task) => task.status === 'task-waiting'),
    exec: allTasks.filter((task) => task.status === 'task-execution'),
    backlog: allTasks.filter((task) => task.status === 'task-backlog'),
    done: allTasks.filter((task) => task.status === 'task-complete'),
    allTasks,
  };
  mergedLists.queue.sort(compareControlRoomQueueTasks);
  const fingerprints = projections.map((projection) => text(projection.fingerprint));
  return {
    ...projections[0],
    ...mergedLists,
    projects,
    ledgers: Array.from(new Set(projections.flatMap((projection) => Array.isArray(projection.ledgers) ? projection.ledgers.map(String) : []))).sort(),
    diagnostics: [
      ...projections.flatMap((projection) => records(projection.diagnostics)),
      ...conflictDiagnostics,
      ...input.diagnostics,
    ],
    fingerprint: createHash('sha256').update(JSON.stringify(fingerprints)).digest('hex'),
    federation: { nodeCount: projections.length, remoteNodeCount: projections.length - 1 },
  };
}
