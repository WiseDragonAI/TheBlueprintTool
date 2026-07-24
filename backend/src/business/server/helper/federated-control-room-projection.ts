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
  const projectId = text(project.id).trim();
  return projectId ? `project:${projectId}` : `node:${text(project.ownerNodeId)}`;
}

function taskSemanticFingerprint(task: AnyRecord): string {
  const semantic = Object.fromEntries(Object.entries(task).filter(([key]) => ![
    'projectId', 'localProjectId', 'ownerNodeId', 'ownerNodeLabel', 'ownerOnline', 'remote',
    'projectName', 'projectColor', 'ledger', 'ledgerTitle',
    'logicalProjectKey', 'replica', 'replicas', 'replicaCount', 'conflict',
    'status', 'executionStatus', 'executionObservation', 'executionSince', 'executionTime',
    'execution', 'executionObservations', 'executionNodeId', 'executionNodeLabel',
    'executionOwnerCardId', 'executionOwnerKind',
    'codexStatus', 'codexProcessing', 'codexQueued', 'codexQueuePosition', 'transcribingBeforeLaunch',
    'codexRunId', 'codexPipelineRunId', 'codexThreadRunId', 'codexRunModel', 'codexRunEffort',
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
  const nodeCatalog = new Map([
    [input.localOwner.nodeId, { label: input.localOwner.nodeLabel, online: true }],
    ...input.remoteProjections.map(({ owner }) => [owner.nodeId, { label: owner.nodeLabel, online: owner.online !== false }] as const),
  ]);
  const qualify = (projection: AnyRecord, owner: Owner): AnyRecord => {
    const projects = records(projection.projects).map((project) => {
      const localProjectId = text(project.id);
      const qualified = {
        ...project,
        id: localProjectId,
        localProjectId,
        ownerNodeId: owner.nodeId,
        ownerNodeLabel: owner.nodeLabel,
        online: owner.online !== false,
        remote: owner.remote,
      };
      return { ...qualified, logicalProjectKey: logicalProjectKey(qualified) };
    });
    const projectByLocalId = new Map(projects.map((project) => [text(project.localProjectId), project]));
    const qualifyTask = (value: unknown): AnyRecord => {
      const task = value && typeof value === 'object' ? value as AnyRecord : {};
      const localProjectId = text(task.projectId);
      const project = projectByLocalId.get(localProjectId);
      const executionObservation = task.executionObservation && typeof task.executionObservation === 'object'
        ? { ...task.executionObservation as AnyRecord, nodeId: owner.nodeId, nodeLabel: owner.nodeLabel }
        : null;
      return {
        ...task,
        projectId: localProjectId,
        localProjectId,
        logicalProjectKey: project?.logicalProjectKey ?? `node:${owner.nodeId}:${localProjectId}`,
        ownerNodeId: owner.nodeId,
        ownerNodeLabel: owner.nodeLabel,
        ownerOnline: owner.online !== false,
        remote: owner.remote,
        executionObservation,
      };
    };
    const list = (key: string): AnyRecord[] => records(projection[key]).map((value) => qualifyTask(value));
    return {
      ...projection,
      queue: list('queue'),
      exec: list('exec'),
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
      replicas: [...members].sort((left, right) => text(left.ownerNodeId).localeCompare(text(right.ownerNodeId))).map((member) => ({
        projectId: authority.id,
        nodeId: member.ownerNodeId,
        nodeLabel: member.ownerNodeLabel,
        online: member.online,
        local: member.remote !== true,
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
    const authorityExecution = authority.execution && typeof authority.execution === 'object' && !Array.isArray(authority.execution)
      ? authority.execution as AnyRecord
      : {};
    const intentPhase = text(authorityExecution.phase);
    const intentExecutionId = text(authorityExecution.executionId);
    const structuralExecution = ['preparing', 'queued', 'starting', 'running'].includes(intentPhase);
    const observationMembers = members.filter((member) => {
      const candidate = member.executionObservation && typeof member.executionObservation === 'object'
        ? member.executionObservation as AnyRecord
        : null;
      if (!candidate) return false;
      if (!intentExecutionId) return true;
      return text(candidate.executionId) === intentExecutionId
        && Number(candidate.revision) === Number(authorityExecution.revision)
        && Date.parse(text(candidate.expiresAt)) > Date.now();
    });
    const orderedObservationMembers = [...observationMembers].sort((left, right) => {
      const priority = (member: AnyRecord): number => {
        const candidate = member.executionObservation as AnyRecord | undefined;
        const phase = text(candidate?.phase);
        const kind = text(candidate?.kind);
        return phase === 'running' || kind === 'codex-process' ? 0 : phase === 'starting' ? 1 : kind === 'voice-transcription' ? 2 : 3;
      };
      return priority(left) - priority(right)
        || text(left.ownerNodeId).localeCompare(text(right.ownerNodeId));
    });
    const executionMember = orderedObservationMembers[0];
    const observation = executionMember?.executionObservation as AnyRecord | undefined;
    const cardStatus = text(authority.cardStatus) || 'todo';
    const status = structuralExecution || observation
      ? 'task-execution'
      : cardStatus === 'backlog'
        ? 'task-backlog'
        : cardStatus === 'done'
          ? 'task-complete'
          : 'task-waiting';
    const fingerprints = new Set(members.map(taskSemanticFingerprint));
    const stateConflict = fingerprints.size > 1;
    const executionConflict = orderedObservationMembers.length > 1;
    const conflict = stateConflict || executionConflict;
    if (stateConflict) {
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
    if (executionConflict) {
      conflictDiagnostics.push({
        valid: false,
        type: 'federation_execution_conflict',
        projectId: authority.projectId,
        ledgerId: authority.ledgerId,
        cardId: authority.cardId,
        nodeIds: orderedObservationMembers.map((member) => text(member.ownerNodeId)),
        message: 'Multiple replicas report verified execution for the same logical card.',
      });
    }
    const assignedNodeId = text(authority.assignedNodeId);
    const assignedNode = nodeCatalog.get(assignedNodeId);
    return {
      ...authority,
      status,
      execution: executionMember?.execution ?? authority.execution ?? null,
      executionObservation: observation ?? null,
      executionObservations: orderedObservationMembers.map((member) => member.executionObservation),
      executionStatus: structuralExecution
        ? ((intentPhase === 'starting' || intentPhase === 'running') && !observation ? 'interrupted' : intentPhase)
        : observation?.kind === 'codex-process' ? 'running' : observation?.kind === 'codex-queue' ? 'queued' : observation?.kind === 'voice-transcription' ? 'preparing' : '',
      executionSince: structuralExecution ? text(authority.executionSince) : observation?.kind === 'codex-process' ? text(executionMember.executionSince) : '',
      executionTime: structuralExecution ? Number(authority.executionTime) : observation?.kind === 'codex-process' ? Number(executionMember.executionTime) : Number.NaN,
      executionOwnerCardId: structuralExecution ? text(authority.executionOwnerCardId) : observation ? text(executionMember.executionOwnerCardId) || text(observation.cardId) : '',
      executionOwnerKind: structuralExecution ? text(authority.executionOwnerKind) : observation ? text(executionMember.executionOwnerKind) || text(observation.ownerKind) : '',
      codexRunId: structuralExecution ? text(executionMember?.codexRunId) || text(authority.codexRunId) : observation?.kind === 'codex-process' || observation?.kind === 'codex-queue' ? text(executionMember.codexRunId) : text(authority.codexRunId),
      codexPipelineRunId: structuralExecution ? text(executionMember?.codexPipelineRunId) || text(authority.codexPipelineRunId) : observation?.kind === 'codex-process' || observation?.kind === 'codex-queue' ? text(executionMember.codexPipelineRunId) : text(authority.codexPipelineRunId),
      codexStatus: structuralExecution ? intentPhase : observation?.kind === 'codex-process' ? 'running' : observation?.kind === 'codex-queue' ? 'queued' : text(authority.codexStatus),
      codexProcessing: structuralExecution ? intentPhase === 'starting' || intentPhase === 'running' : observation?.kind === 'codex-process',
      codexQueued: structuralExecution ? intentPhase === 'queued' : observation?.kind === 'codex-queue',
      codexQueuePosition: structuralExecution ? authority.codexQueuePosition ?? null : observation?.kind === 'codex-queue' ? executionMember.codexQueuePosition ?? null : null,
      transcribingBeforeLaunch: structuralExecution ? intentPhase === 'preparing' && authority.transcribingBeforeLaunch === true : observation?.kind === 'voice-transcription',
      executionNodeId: observation ? text(observation.executorNodeId) || text(observation.nodeId) : '',
      executionNodeLabel: observation ? text(observation.nodeLabel) || text(executionMember.ownerNodeLabel) : '',
      assignedNodeId,
      assignedNodeLabel: assignedNode?.label ?? assignedNodeId,
      assignedNodeOnline: assignedNode?.online ?? false,
      conflict,
      replicaCount: members.length,
      replicas: [...members].sort((left, right) => text(left.ownerNodeId).localeCompare(text(right.ownerNodeId))).map((member) => ({
        projectId: authority.projectId,
        nodeId: member.ownerNodeId,
        nodeLabel: member.ownerNodeLabel,
        online: member.ownerOnline,
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
  // WHAT: Bind the public projection revision to both replica content and owner presence.
  // WHY: Presence changes alter task/project output even when every retained replica revision is unchanged.
  const fingerprints = projections.map((projection) => ({
    fingerprint: text(projection.fingerprint),
    projects: records(projection.projects).map((project) => ({
      id: text(project.id),
      ownerNodeId: text(project.ownerNodeId),
      online: project.online !== false,
    })),
  }));
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
