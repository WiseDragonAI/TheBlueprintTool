/**
 * WHAT: Reads and writes one replaceable task-state restart checkpoint.
 * WHY: Warm startup must avoid reopening every canonical shard while stale checkpoints fall back safely.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskCausalClock, TaskCurrentBucket, TaskCurrentEntity, TaskCurrentProjection } from './task-current-state-types.js';

export type TaskPublicationSnapshot = Array<{ taskId: string; entityKeys: string[] }>;
export type TaskStateCheckpointWitness = Record<string, { exists: boolean; mtimeMs: number; ctimeMs: number; size: number }>;
export type TaskStateCheckpointPayload = {
  version: 1;
  projectId: string;
  entities: TaskCurrentEntity[];
  projection: TaskCurrentProjection;
  clock: TaskCausalClock;
  buckets: TaskCurrentBucket[];
  publication: TaskPublicationSnapshot;
  witness: TaskStateCheckpointWitness;
};

type Document = { payload: TaskStateCheckpointPayload; checksum: string };

export function taskStateCheckpointWitness(paths: Record<string, string>): TaskStateCheckpointWitness {
  const witness: TaskStateCheckpointWitness = {};
  const visit = (key: string, path: string): void => {
    // WHAT: Represent an absent canonical path without creating it.
    // WHY: A later journal, shard, or marker path must invalidate the checkpoint.
    if (!existsSync(path)) {
      witness[key] = { exists: false, mtimeMs: 0, ctimeMs: 0, size: 0 };
      return;
    }
    const stat = statSync(path);
    witness[key] = { exists: true, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size };
    // WHAT: Capture each canonical descendant's cheap filesystem identity.
    // WHY: In-place shard corruption does not change its parent directory timestamp.
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(`${key}/${name}`, resolve(path, name));
    }
  };
  for (const [key, path] of Object.entries(paths)) visit(key, path);
  return witness;
}

function encodedPayload(payload: TaskStateCheckpointPayload): string {
  return JSON.stringify(payload);
}

export function encodeTaskStateCheckpoint(payload: TaskStateCheckpointPayload): string {
  const encoded = encodedPayload(payload);
  return `${JSON.stringify({ payload, checksum: createHash('sha256').update(encoded).digest('hex') })}\n`;
}

export function readTaskStateCheckpoint(input: {
  file: string;
  projectId: string;
  witness: TaskStateCheckpointWitness;
}): { status: 'missing' } | { status: 'invalid'; error: string } | { status: 'valid'; payload: TaskStateCheckpointPayload } {
  // WHAT: Select canonical reconstruction when no checkpoint has been populated yet.
  // WHY: Existing projects require no migration before gaining the optimization.
  if (!existsSync(input.file)) return { status: 'missing' };
  try {
    const document = JSON.parse(readFileSync(input.file, 'utf8')) as Document;
    const payload = document?.payload;
    const checksum = payload ? createHash('sha256').update(encodedPayload(payload)).digest('hex') : '';
    // WHAT: Reject a checkpoint outside its exact project and schema.
    // WHY: A cache may never become cross-project task authority.
    if (payload?.version !== 1 || payload.projectId !== input.projectId || document.checksum !== checksum) throw new Error('invalid_task_state_checkpoint');
    // WHAT: Reject a checkpoint after any canonical directory changed.
    // WHY: Journals and externally replaced shards must force canonical replay.
    if (JSON.stringify(payload.witness) !== JSON.stringify(input.witness)) throw new Error('stale_task_state_checkpoint');
    const keys = new Set<string>();
    for (const entity of payload.entities) {
      const key = `${entity.entityType}\u0000${entity.entityId}`;
      // WHAT: Reject duplicate or cross-project cached identities.
      // WHY: Direct map installation requires one unambiguous entity per stable key.
      if (!entity.entityId || entity.projectId !== input.projectId || keys.has(key)) throw new Error('invalid_task_state_checkpoint_entity');
      keys.add(key);
    }
    for (const marker of payload.publication) {
      // WHAT: Reject held references absent from the cached entity set.
      // WHY: Publication visibility must not conceal an unknown entity.
      if (!marker.taskId || marker.entityKeys.some((key) => !keys.has(key))) throw new Error('invalid_task_state_checkpoint_publication');
    }
    return { status: 'valid', payload };
  } catch (error) {
    return { status: 'invalid', error: error instanceof Error ? error.message : String(error) };
  }
}
