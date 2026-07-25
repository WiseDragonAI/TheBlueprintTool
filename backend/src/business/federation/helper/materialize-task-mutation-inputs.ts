/**
 * WHAT: Materializes the exact task Markdown resources a local mutation will read.
 * WHY: The synchronous mutation layer must never interpret a projected but absent Epoch 4 resource as empty.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { FederationContentReplicaStore } from './federation-content-replica-store.js';
import { readTaskContentOnDemand } from './read-task-content-on-demand.js';

type AnyRecord = Record<string, unknown>;

export class TaskContentMaterializationError extends Error {
  constructor(
    public readonly statusCode: 409 | 503,
    public readonly code: string,
    public readonly key: string,
  ) {
    super(code);
  }
}

function resourceKeys(ledger: AnyRecord, mutation: LedgerMutation): string[] {
  const keys = new Set<string>();
  const threadId = String(mutation.note?.threadId ?? '');
  const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles)
    ? ledger.threadFiles as AnyRecord
    : {};
  if (threadId && typeof threadFiles[threadId] === 'string') keys.add(String(threadFiles[threadId]));

  const cardId = String(mutation.cardPatch?.id ?? mutation.cardId ?? '');
  const readsCardMarkdown = (
    mutation.action === 'delete-card-image'
    || (mutation.action === 'patch-card' && typeof mutation.cardPatch?.description === 'string')
  );
  if (cardId && readsCardMarkdown) {
    const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
    const card = cards.find((candidate) => String(candidate.id ?? '') === cardId);
    const comment = card?.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
      ? card.comment as AnyRecord
      : {};
    if (typeof comment.contentFile === 'string') keys.add(comment.contentFile);
  }
  return [...keys];
}

export async function materializeTaskMutationInputs(input: {
  projectId: string;
  decisionOsRoot: string;
  ledger: AnyRecord;
  mutation: LedgerMutation;
  store: TaskCurrentStateStore;
  contentStore: FederationContentReplicaStore;
  drain: (() => Promise<void>) | null;
  validate?: (key: string, body: string) => void | Promise<void>;
}): Promise<void> {
  return materializeTaskResources({ ...input, keys: resourceKeys(input.ledger, input.mutation) });
}

export async function materializeTaskResources(input: {
  projectId: string;
  decisionOsRoot: string;
  keys: string[];
  store: TaskCurrentStateStore;
  contentStore: FederationContentReplicaStore;
  drain: (() => Promise<void>) | null;
  validate?: (key: string, body: string) => void | Promise<void>;
}): Promise<void> {
  const pendingInstalls: Array<{ file: string; body: string }> = [];
  for (const key of input.keys) {
    const file = resolve(input.decisionOsRoot, key.replace(/^\/?\.decision-os\//, ''));
    const inner = relative(input.decisionOsRoot, file);
    if (!inner || inner.startsWith('..') || isAbsolute(inner)) {
      throw new TaskContentMaterializationError(409, 'task_content_reference_invalid', key);
    }
    const candidates = input.store.contentHeads(key);
    const hashes = new Set(candidates.map((candidate) => candidate.hash));
    const byteCounts = new Set(candidates.map((candidate) => candidate.bytes));
    if (hashes.size > 1 || byteCounts.size > 1) {
      throw new TaskContentMaterializationError(409, 'task_content_conflict', key);
    }
    if (existsSync(file)) {
      const localBytes = readFileSync(file);
      const localBody = localBytes.toString('utf8');
      if (candidates.length === 0) {
        await input.validate?.(key, localBody);
        continue;
      }
      const localHash = createHash('sha256').update(localBytes).digest('hex');
      // WHAT: Verify existing mutable bytes against the same unique head used for remote materialization.
      // WHY: A present but stale sidecar is as destructive as a missing sidecar when used as mutation input.
      if (!hashes.has(localHash) || !byteCounts.has(localBytes.byteLength)) {
        throw new TaskContentMaterializationError(409, 'task_content_local_mismatch', key);
      }
      await input.validate?.(key, localBody);
      continue;
    }
    const content = await readTaskContentOnDemand({
      projectId: input.projectId,
      store: input.store,
      key,
      contentStore: input.contentStore,
      drain: input.drain,
    });
    if (content.conflict) throw new TaskContentMaterializationError(409, 'task_content_conflict', key);
    if (!content.available) throw new TaskContentMaterializationError(503, 'task_content_unavailable', key);
    const actualHash = createHash('sha256').update(content.body).digest('hex');
    const actualBytes = Buffer.byteLength(content.body);
    if (hashes.size !== 1 || !hashes.has(actualHash) || byteCounts.size !== 1 || !byteCounts.has(actualBytes)) {
      throw new TaskContentMaterializationError(503, 'task_content_verification_failed', key);
    }
    await input.validate?.(key, content.body);
    pendingInstalls.push({ file, body: content.body });
  }
  // WHAT: Finish resolution, verification, and caller validation for every resource before installing the first sidecar.
  // WHY: A rejected multi-resource execution must not partially materialize watcher-visible inputs.
  for (const { file, body } of pendingInstalls) {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.install-${process.pid}-${randomUUID()}`;
    try {
      // WHAT: Install verified source bytes without generating a local content contribution.
      // WHY: Materialization reproduces the selected head; only the later user mutation may publish a new head.
      writeFileSync(temporary, body, { encoding: 'utf8', flag: 'wx' });
      renameSync(temporary, file);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }
}
