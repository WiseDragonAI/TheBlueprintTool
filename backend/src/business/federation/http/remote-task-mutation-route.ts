/**
 * WHAT: Applies task mutations against a durable remote-project replica.
 * WHY: Replica content admission and causal mutation receipts belong to federation task handling.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { applyLedgerMutation, type LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { readTaskContentOnDemand } from '../helper/read-task-content-on-demand.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { createFederationContentReplicaStore } from '../helper/federation-content-replica-store.js';

type AnyRecord = Record<string, unknown>;

export async function handleRemoteTaskMutationRoute(input: {
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  drainContent: (() => Promise<void>) | null;
  invalidateProject: (entities: readonly { entityType: string; entityId: string }[]) => void;
  masterDecisionOsRoot: string;
  pendingPublication: () => boolean;
  projectId: string;
  request: IncomingMessage;
  response: ServerResponse;
  revision: () => number;
  scopedPath: string;
  state: ProjectTaskState | null;
  stateStatus: AnyRecord;
}): Promise<{ handled: boolean }> {
  if (input.request.method !== 'PATCH' || input.scopedPath !== '/decision-os/tasks') {
    return { handled: false };
  }
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  const projection = input.state?.store.diagnostics().entityCount
    ? input.state.projection()
    : null;
  if (!input.state || !projection) {
    input.response.statusCode = 503;
    input.response.end(JSON.stringify({
      ok: false,
      error: 'task_replica_not_ready',
      state: input.stateStatus,
    }));
    return { handled: true };
  }
  let mutation: LedgerMutation;
  try {
    mutation = JSON.parse((await readRequestBuffer(input.request)).toString('utf8') || '{}') as LedgerMutation;
  } catch {
    input.response.statusCode = 400;
    input.response.end(JSON.stringify({ ok: false, error: 'invalid_task_mutation_json' }));
    return { handled: true };
  }
  const before = structuredClone(projection.ledger);
  const threadId = String(mutation.note?.threadId ?? '');
  if (threadId) {
    const refs = before.threadFiles && typeof before.threadFiles === 'object' && !Array.isArray(before.threadFiles)
      ? before.threadFiles as AnyRecord
      : {};
    const key = String(refs[threadId] ?? '');
    if (!key) {
      input.response.statusCode = 409;
      input.response.end(JSON.stringify({ ok: false, error: 'task_thread_reference_missing', threadId }));
      return { handled: true };
    }
    const replicaRoot = resolve(input.masterDecisionOsRoot, 'cache', 'federation-task-state');
    const localFile = resolve(replicaRoot, key.replace(/^\/?\.decision-os\//, ''));
    const relativeFile = relative(replicaRoot, localFile);
    if (!relativeFile || relativeFile.startsWith('..') || isAbsolute(relativeFile)) {
      input.response.statusCode = 400;
      input.response.end(JSON.stringify({ ok: false, error: 'task_thread_reference_invalid', threadId }));
      return { handled: true };
    }
    if (!existsSync(localFile)) {
      const content = await readTaskContentOnDemand({
        projectId: input.projectId,
        store: input.state.store,
        key,
        contentStore: input.contentStore,
        drain: input.drainContent,
      });
      if (!content.available || content.conflict) {
        input.response.statusCode = 409;
        input.response.end(JSON.stringify({
          ok: false,
          error: content.conflict ? 'task_thread_content_conflict' : 'task_thread_content_unavailable',
          threadId,
          candidates: content.candidates,
        }));
        return { handled: true };
      }
      mkdirSync(dirname(localFile), { recursive: true });
      const temporary = `${localFile}.install-${process.pid}-${Date.now()}`;
      writeFileSync(temporary, content.body);
      renameSync(temporary, localFile);
    }
  }
  const after = structuredClone(before);
  const replicaRoot = resolve(input.masterDecisionOsRoot, 'cache', 'federation-task-state');
  const mutationResult = applyLedgerMutation({
    decisionOsRoot: replicaRoot,
    ledgerPath: resolve(replicaRoot, 'replica-ledgers', `${input.projectId}.json`),
    ledger: after,
    mutation,
  });
  if (mutationResult.error) {
    input.response.statusCode = mutationResult.error.statusCode;
    input.response.end(JSON.stringify(mutationResult.error.body));
    return { handled: true };
  }
  const committed = await input.state.executeMutation(
    mutation,
    before,
    after,
    mutationResult.changedContentFiles,
  );
  if (committed.changed) input.invalidateProject(committed.localChanges);
  const revision = input.revision();
  const taskClock = input.state.store.clientClock();
  input.response.setHeader('x-decision-os-ledger-revision', String(revision));
  input.response.setHeader('x-decision-os-task-clock', Buffer.from(JSON.stringify(taskClock)).toString('base64url'));
  input.response.end(JSON.stringify({
    ok: true,
    ledgerId: 'tasks',
    revision,
    taskClock,
    receipt: {
      mutationId: String(mutation.mutationId ?? ''),
      clock: taskClock,
      entities: committed.localChanges,
    },
    locallyCommitted: true,
    publicationPending: input.pendingPublication(),
    ledger: committed.ledger,
  }));
  return { handled: true };
}
