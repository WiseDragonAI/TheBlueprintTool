/**
 * WHAT: Persists task-scoped federation replicas and restart-safe synchronization work.
 * WHY: Remote task reads must remain local and priority requests must survive reconnects.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;

export type FederationReplicaSnapshot = {
  version: 1;
  revision: string;
  generatedAt: string;
  project: AnyRecord;
  controlRoom: AnyRecord;
  state: AnyRecord;
  ledgers: Record<string, {
    navigation: AnyRecord;
    cards: Record<string, AnyRecord>;
    threads: Record<string, AnyRecord>;
  }>;
};

type PendingReplica = {
  nodeId: string;
  projectId: string;
  priority: 'selected' | 'normal';
  resource: string;
  queuedAt: string;
  attempts: number;
  nextAttemptAt: string;
};

type PeerReplicaState = {
  nodeLabel: string;
  online: boolean;
  lastSuccessAt: string;
  lastError: string;
  projects: Record<string, FederationReplicaSnapshot>;
};

type ReplicaDocument = {
  version: 1;
  peers: Record<string, PeerReplicaState>;
  pending: PendingReplica[];
};

export type FederationReplicaStatus = 'replicated' | 'synchronizing' | 'stale' | 'blocked' | 'offline';

const emptyDocument = (): ReplicaDocument => ({ version: 1, peers: {}, pending: [] });

export function createFederationReplicaStore(input: { decisionOsRoot: string; now?: () => Date }) {
  const file = resolve(input.decisionOsRoot, 'cache', 'federation-task-replicas-v1.json');
  const now = input.now ?? (() => new Date());
  let document: ReplicaDocument;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as ReplicaDocument;
    document = parsed?.version === 1 && parsed.peers && Array.isArray(parsed.pending) ? parsed : emptyDocument();
  } catch {
    document = emptyDocument();
  }

  const persist = (): void => {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temporary, `${JSON.stringify(document)}\n`);
    renameSync(temporary, file);
  };
  const peer = (nodeId: string): PeerReplicaState => (document.peers[nodeId] ??= {
    nodeLabel: nodeId,
    online: false,
    lastSuccessAt: '',
    lastError: '',
    projects: {},
  });
  const pendingFor = (nodeId: string, projectId: string): PendingReplica | undefined => document.pending
    .find((entry) => entry.nodeId === nodeId && entry.projectId === projectId);
  const dueFor = (nodeId: string): PendingReplica[] => {
    const timestamp = now().getTime();
    return document.pending
      .filter((entry) => entry.nodeId === nodeId && Date.parse(entry.nextAttemptAt) <= timestamp)
      .sort((left, right) => (left.priority === right.priority ? left.queuedAt.localeCompare(right.queuedAt) : left.priority === 'selected' ? -1 : 1));
  };
  const readStatus = (nodeId: string, projectId: string): { status: FederationReplicaStatus; updatedAt: string; message: string; resource: string } => {
    const state = document.peers[nodeId];
    const snapshot = state?.projects[projectId];
    const pending = pendingFor(nodeId, projectId);
    let status: FederationReplicaStatus;
    if (!state?.online) status = 'offline';
    else if (!snapshot && state.lastError) status = 'blocked';
    else if (pending) status = 'synchronizing';
    else if (snapshot && state.lastError) status = 'stale';
    else if (snapshot) status = 'replicated';
    else status = 'blocked';
    return {
      status,
      updatedAt: snapshot?.generatedAt ?? state?.lastSuccessAt ?? '',
      message: state?.lastError || (status === 'offline' ? 'Owner offline; retained replica is being used.' : status === 'synchronizing' ? 'Synchronizing task replica.' : status === 'blocked' ? 'Task replica is not available yet.' : ''),
      resource: pending?.resource ?? '',
    };
  };

  return {
    file,
    setPeer(nodeId: string, nodeLabel: string, online: boolean): void {
      const state = peer(nodeId);
      const changed = state.nodeLabel !== nodeLabel || state.online !== online;
      state.nodeLabel = nodeLabel;
      state.online = online;
      if (changed) persist();
    },
    enqueue(nodeId: string, projectId: string, priority: PendingReplica['priority'] = 'normal', resource = ''): void {
      const existing = pendingFor(nodeId, projectId);
      if (existing) {
        const upgraded = priority === 'selected' && existing.priority !== 'selected';
        existing.priority = upgraded ? 'selected' : existing.priority;
        if (resource) existing.resource = resource;
        if (upgraded) existing.nextAttemptAt = now().toISOString();
        persist();
        return;
      }
      const timestamp = now().toISOString();
      document.pending.push({ nodeId, projectId, priority, resource, queuedAt: timestamp, attempts: 0, nextAttemptAt: timestamp });
      persist();
    },
    next(nodeId: string): PendingReplica | null {
      return dueFor(nodeId)[0] ?? null;
    },
    due(nodeId: string): PendingReplica[] {
      return dueFor(nodeId);
    },
    complete(nodeId: string, projectId: string, snapshot: FederationReplicaSnapshot): void {
      const state = peer(nodeId);
      const current = state.projects[projectId];
      const currentTime = Date.parse(current?.generatedAt ?? '');
      const incomingTime = Date.parse(snapshot.generatedAt);
      if (!current || current.revision === snapshot.revision || !Number.isFinite(currentTime) || !Number.isFinite(incomingTime) || incomingTime >= currentTime) {
        state.projects[projectId] = snapshot;
      }
      state.lastSuccessAt = now().toISOString();
      state.lastError = '';
      document.pending = document.pending.filter((entry) => entry.nodeId !== nodeId || entry.projectId !== projectId);
      persist();
    },
    fail(nodeId: string, projectId: string, message: string): void {
      const state = peer(nodeId);
      state.lastError = message;
      const pending = pendingFor(nodeId, projectId);
      if (pending) {
        pending.attempts += 1;
        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(6, pending.attempts));
        pending.nextAttemptAt = new Date(now().getTime() + delay).toISOString();
      }
      persist();
    },
    replica(nodeId: string, projectId: string): FederationReplicaSnapshot | null {
      return document.peers[nodeId]?.projects[projectId] ?? null;
    },
    status(nodeId: string, projectId: string): { status: FederationReplicaStatus; updatedAt: string; message: string; resource: string } {
      return readStatus(nodeId, projectId);
    },
    peerProjections(): Array<{ nodeId: string; nodeLabel: string; projection: AnyRecord }> {
      return Object.entries(document.peers).flatMap(([nodeId, state]) => {
        const snapshots = Object.entries(state.projects);
        if (snapshots.length === 0) return [];
        const tasks = snapshots.flatMap(([, snapshot]) => Array.isArray(snapshot.controlRoom.allTasks) ? snapshot.controlRoom.allTasks as AnyRecord[] : []);
        const withStatus: AnyRecord[] = tasks.map((task): AnyRecord => ({
          ...task,
          replica: readStatus(nodeId, String(task.projectId ?? '')),
          ownerOnline: state.online,
        }));
        const list = (name: string): AnyRecord[] => withStatus.filter((task) => task.status === name);
        return [{
          nodeId,
          nodeLabel: state.nodeLabel,
          projection: {
            queue: list('task-waiting'),
            exec: list('task-execution'),
            backlog: list('task-backlog'),
            done: list('task-complete'),
            allTasks: withStatus,
            projects: snapshots.map(([projectId, snapshot]) => ({ ...snapshot.project, id: projectId, online: state.online, replica: readStatus(nodeId, projectId) })),
            diagnostics: state.lastError ? [{ valid: false, ownerNodeId: nodeId, message: state.lastError }] : [],
            fingerprint: snapshots.map(([, snapshot]) => snapshot.revision).join(':'),
          },
        }];
      });
    },
  };
}

export type FederationReplicaStore = ReturnType<typeof createFederationReplicaStore>;
