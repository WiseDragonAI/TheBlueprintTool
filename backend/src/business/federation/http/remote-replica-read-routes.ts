/**
 * WHAT: Serves task ledger, card, and thread reads from a durable remote-project replica.
 * WHY: Replica convergence and content hydration belong to federation read handling.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import { parseThreadMarkdown } from '../../ledger/helper/thread-content-file.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { createFederationContentReplicaStore } from '../helper/federation-content-replica-store.js';

type AnyRecord = Record<string, unknown>;

export function remoteReplicaStateStatus(input: {
  contentDegraded?: boolean;
  contentStatus?: AnyRecord;
  online: boolean;
  relayConvergence?: { converged?: boolean; root?: string; lastRepairAt?: string };
  resourceReady?: boolean;
  scopedPath: string;
  taskRoot: string;
  taskRootReady: boolean;
}): AnyRecord {
  const relayRootCurrent = Boolean(
    input.relayConvergence?.converged
    && input.relayConvergence.root === input.taskRoot,
  );
  const task = !input.online
    ? {
      status: 'offline',
      updatedAt: input.relayConvergence?.lastRepairAt ?? '',
      message: 'Serving the durable local task replica while its owner is offline.',
      resource: '',
      root: input.relayConvergence?.root ?? '',
    }
    : relayRootCurrent
      ? {
        status: 'synchronized',
        updatedAt: input.relayConvergence?.lastRepairAt ?? '',
        message: '',
        resource: '',
        root: input.relayConvergence?.root ?? '',
      }
      : {
        status: 'synchronizing',
        updatedAt: input.relayConvergence?.lastRepairAt ?? '',
        message: 'Publishing the local task revision and reconciling the relay root.',
        resource: input.scopedPath,
        root: input.relayConvergence?.root ?? '',
      };
  const content = input.contentStatus ?? { status: 'not-required', resource: '', error: '' };
  const resourceReady = input.resourceReady ?? true;
  return {
    status: input.contentDegraded
      ? 'degraded'
      : !input.taskRootReady || !resourceReady
        ? 'synchronizing'
        : !input.online
          ? 'offline'
          : !relayRootCurrent
            ? 'synchronizing'
            : 'synchronized',
    resource: String(content.resource || input.scopedPath),
    task,
    content,
  };
}

export async function handleRemoteReplicaReadRoutes(input: {
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  drainContent: (() => Promise<void>) | null;
  ownerNodeId: string;
  paused: () => boolean;
  projectId: string;
  projection: AnyRecord | null;
  recordBackgroundFailure: (operation: string, error: unknown, context: AnyRecord) => void;
  relayConvergence?: {
    converged?: boolean;
    root?: string;
    lastRepairAt?: string;
  };
  remoteProject: { name: string; color: string; ledgers: unknown; online: boolean };
  request: IncomingMessage;
  response: ServerResponse;
  scopedPath: string;
  taskStore: TaskCurrentStateStore | null;
}): Promise<{ handled: boolean }> {
  if (input.request.method !== 'GET') return { handled: false };
  const ledgerRead = input.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/navigation$/);
  const cardRead = input.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)$/);
  const threadRead = input.scopedPath.match(/^\/api\/ledgers\/([^/]+)\/threads\/([^/]+)$/);
  const replicaRead = input.scopedPath === '/decision-os/state' || Boolean(ledgerRead || cardRead || threadRead);
  if (!replicaRead) return { handled: false };
  const taskRootReady = Boolean(input.projection);
  const taskRoot = input.taskStore?.rootHash() ?? '';
  const relayRootCurrent = Boolean(
    input.relayConvergence?.converged
    && input.relayConvergence.root === taskRoot,
  );
  let body: AnyRecord | null = null;
  let resourceReady = true;
  let contentDegraded = false;
  let contentStatus: AnyRecord = { status: 'not-required', resource: '', error: '' };
  if (input.projection && taskRootReady) {
    const ledger = input.projection.ledger as AnyRecord;
    if (input.scopedPath === '/decision-os/state') {
      body = {
        projectId: input.projectId,
        projectName: input.remoteProject.name,
        projectColor: input.remoteProject.color,
        ledgers: input.remoteProject.ledgers,
      };
    }
    if (ledgerRead) {
      body = {
        ...ledger,
        cards: (Array.isArray(ledger.cards) ? ledger.cards : []).map((card) => {
          const value = card as AnyRecord;
          return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'comment'));
        }),
      };
    }
    if (cardRead) {
      const cardId = decodeRouteSegment(cardRead[2]);
      const card = (Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [])
        .find((entry) => String(entry.id ?? '') === cardId);
      if (card) {
        const comment = card.comment && typeof card.comment === 'object'
          ? card.comment as AnyRecord
          : {};
        const resourceKey = String(comment.contentFile ?? '');
        const heads = input.taskStore?.contentHeads(resourceKey) ?? [];
        for (const head of heads) {
          input.contentStore.applyManifest(head.sourceReplicaId, {
            version: 1,
            projectId: input.projectId,
            generatedAt: new Date().toISOString(),
            complete: false,
            resources: [{
              type: head.type,
              key: head.key,
              hash: head.hash,
              bytes: head.bytes,
              changedAt: head.changedAt,
            }],
          });
        }
        const contentOwner = heads.find((head) => head.sourceReplicaId === input.ownerNodeId)?.sourceReplicaId
          ?? heads[0]?.sourceReplicaId
          ?? input.ownerNodeId;
        const content = input.contentStore.resource(contentOwner, input.projectId, resourceKey);
        const missingReferencedHead = Boolean(resourceKey) && heads.length === 0 && relayRootCurrent;
        contentDegraded = missingReferencedHead;
        resourceReady = !resourceKey || Boolean(content.file) || missingReferencedHead;
        contentStatus = {
          status: missingReferencedHead ? 'missing-head' : content.state,
          resource: resourceKey,
          error: missingReferencedHead ? 'task_content_head_missing' : content.error,
          conflict: content.conflict,
          candidates: content.candidates,
        };
        if (!resourceReady && heads.length > 0) {
          input.contentStore.prioritize(contentOwner, input.projectId, resourceKey);
          if (!input.paused()) void input.drainContent?.().catch((error: unknown) => {
            input.recordBackgroundFailure('drain-card-content-demand', error, {
              projectId: input.projectId,
              key: resourceKey,
            });
          });
        }
        const markdown = content.file ? await readFile(content.file, 'utf8') : '';
        body = { ...card, comment: { ...comment, ...(content.file ? { what: markdown } : {}) } };
      }
    }
    if (threadRead) {
      const threadId = decodeRouteSegment(threadRead[2]);
      const refs = ledger.threadFiles && typeof ledger.threadFiles === 'object'
        ? ledger.threadFiles as AnyRecord
        : {};
      const resourceKey = String(refs[threadId] ?? '');
      const heads = input.taskStore?.contentHeads(resourceKey) ?? [];
      for (const head of heads) {
        input.contentStore.applyManifest(head.sourceReplicaId, {
          version: 1,
          projectId: input.projectId,
          generatedAt: new Date().toISOString(),
          complete: false,
          resources: [{
            type: head.type,
            key: head.key,
            hash: head.hash,
            bytes: head.bytes,
            changedAt: head.changedAt,
          }],
        });
      }
      const contentOwner = heads.find((head) => head.sourceReplicaId === input.ownerNodeId)?.sourceReplicaId
        ?? heads[0]?.sourceReplicaId
        ?? input.ownerNodeId;
      const content = input.contentStore.resource(contentOwner, input.projectId, resourceKey);
      resourceReady = !resourceKey || Boolean(content.file);
      contentStatus = {
        status: content.state,
        resource: resourceKey,
        error: content.error,
        conflict: content.conflict,
        candidates: content.candidates,
      };
      if (!resourceReady) {
        input.contentStore.prioritize(contentOwner, input.projectId, resourceKey);
        if (!input.paused()) void input.drainContent?.().catch((error: unknown) => {
          input.recordBackgroundFailure('drain-thread-content-demand', error, {
            projectId: input.projectId,
            key: resourceKey,
          });
        });
      }
      const notes = content.file ? parseThreadMarkdown(await readFile(content.file, 'utf8')) : [];
      body = {
        ledgerId: decodeRouteSegment(threadRead[1]),
        threadId,
        threadFiles: resourceKey ? { [threadId]: resourceKey } : {},
        notes: { [threadId]: notes },
      };
    }
  }
  const state = remoteReplicaStateStatus({
    contentDegraded,
    contentStatus,
    online: input.remoteProject.online,
    relayConvergence: input.relayConvergence,
    resourceReady,
    scopedPath: input.scopedPath,
    taskRoot,
    taskRootReady,
  });
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  if (body && taskRootReady && resourceReady) {
    input.response.setHeader('x-decision-os-state-status', String(state.status));
    input.response.end(JSON.stringify({ ...body, state }));
    return { handled: true };
  }
  input.response.statusCode = 202;
  input.response.end(JSON.stringify({ ok: false, error: 'state_synchronizing', state }));
  return { handled: true };
}
