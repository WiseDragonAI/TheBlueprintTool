/**
 * WHAT: Reads and writes one replaceable task-state restart checkpoint plus its constant-work generation marker.
 * WHY: Warm startup must avoid reopening canonical shards while stale or invalid cache bytes fall back safely.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskCausalClock, TaskCurrentBucket, TaskCurrentEntity, TaskCurrentProjection } from './task-current-state-types.js';

export type TaskPublicationSnapshot = Array<{ taskId: string; entityKeys: string[] }>;
export type TaskStateCheckpointWitness = Record<string, { exists: boolean; mtimeMs: number; ctimeMs: number; size: number }>;
type TaskStateCheckpointState = {
  projectId: string;
  entities: TaskCurrentEntity[];
  projection: TaskCurrentProjection;
  clock: TaskCausalClock;
  buckets: TaskCurrentBucket[];
  publication: TaskPublicationSnapshot;
};
export type LegacyTaskStateCheckpointPayload = TaskStateCheckpointState & {
  version: 1;
  witness: TaskStateCheckpointWitness;
};
export type TaskStateCheckpointPayload = TaskStateCheckpointState & {
  version: 2;
  generation: string;
};
export type TaskStateBootstrapReceipt = {
  version: 1;
  projectId: string;
  generation: string;
  checksum: string;
  payload: TaskStateCheckpointPayload;
  persistent: boolean;
  sourceDiagnostics: {
    status: string;
    error: string;
    reads: number;
    shardReads: number;
    markerReads: number;
    projectionMaterializations: number;
  };
};

type CheckpointDocument = { payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload; checksum: string };
type GenerationDocument = { version: 1; projectId: string; generation: string };

export function taskStateCheckpointWitness(paths: Record<string, string>): TaskStateCheckpointWitness {
  const witness: TaskStateCheckpointWitness = {};
  const visit = (key: string, path: string): void => {
    // WHAT: Represent an absent canonical path without creating it.
    // WHY: A later journal, shard, or marker path must invalidate a legacy checkpoint.
    if (!existsSync(path)) {
      witness[key] = { exists: false, mtimeMs: 0, ctimeMs: 0, size: 0 };
      return;
    }
    const stat = statSync(path);
    witness[key] = { exists: true, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size };
    // WHAT: Capture every canonical descendant only while admitting a legacy checkpoint.
    // WHY: Version 1 has no generation marker and requires its original compatibility proof before one-time upgrade.
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(`${key}/${name}`, resolve(path, name));
    }
  };
  for (const [key, path] of Object.entries(paths)) visit(key, path);
  return witness;
}

function encodedPayload(payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload): string {
  return JSON.stringify(payload);
}

function payloadChecksum(payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload): string {
  return createHash('sha256').update(encodedPayload(payload)).digest('hex');
}

function assertGeneration(value: unknown): asserts value is string {
  // WHAT: Reject malformed generation identities before they can authorize cached state.
  // WHY: One unpredictable fixed-width token is the complete constant-work stale-state witness.
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    throw new Error('invalid_task_state_generation');
  }
}

function assertPayload(
  payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload,
  projectId: string,
): void {
  const keys = new Set<string>();
  // WHAT: Validate every cached entity before any snapshot can become runtime authority.
  // WHY: Receipt transfer skips canonical shard parsing and therefore owns complete cached-entity admission.
  for (const entity of payload.entities) {
    const key = `${entity.entityType}\u0000${entity.entityId}`;
    // WHAT: Reject duplicate or cross-project cached identities.
    // WHY: Direct map installation requires one unambiguous entity per stable key.
    if (!entity.entityId || entity.projectId !== projectId || keys.has(key)) throw new Error('invalid_task_state_checkpoint_entity');
    keys.add(key);
  }
  // WHAT: Validate every local publication marker against the admitted entity identity set.
  // WHY: Held-state visibility cannot reference an entity absent from the transferred snapshot.
  for (const marker of payload.publication) {
    // WHAT: Reject held references absent from the cached entity set.
    // WHY: Publication visibility must not conceal an unknown entity.
    if (!marker.taskId || marker.entityKeys.some((key) => !keys.has(key))) throw new Error('invalid_task_state_checkpoint_publication');
  }
}

function readGeneration(input: { file: string; projectId: string }): GenerationDocument {
  // WHAT: Reject a missing generation marker as unavailable restart authority.
  // WHY: Version 2 checkpoints are current only when their separate constant-work witness survives.
  if (!existsSync(input.file)) throw new Error('missing_task_state_generation');
  const generation = JSON.parse(readFileSync(input.file, 'utf8')) as GenerationDocument;
  // WHAT: Bind one generation marker to its exact schema and project.
  // WHY: A copied cache marker cannot authorize another project's state.
  if (generation?.version !== 1 || generation.projectId !== input.projectId) throw new Error('invalid_task_state_generation');
  assertGeneration(generation.generation);
  return generation;
}

export function encodeTaskStateGeneration(input: { projectId: string; generation: string }): string {
  assertGeneration(input.generation);
  return `${JSON.stringify({ version: 1, projectId: input.projectId, generation: input.generation })}\n`;
}

export function encodeTaskStateCheckpoint(payload: TaskStateCheckpointPayload): string {
  return `${JSON.stringify({ payload, checksum: payloadChecksum(payload) })}\n`;
}

export function createTaskStateBootstrapReceipt(input: {
  payload: TaskStateCheckpointPayload;
  persistent: boolean;
  sourceDiagnostics: TaskStateBootstrapReceipt['sourceDiagnostics'];
}): TaskStateBootstrapReceipt {
  return {
    version: 1,
    projectId: input.payload.projectId,
    generation: input.payload.generation,
    checksum: payloadChecksum(input.payload),
    payload: input.payload,
    persistent: input.persistent,
    sourceDiagnostics: { ...input.sourceDiagnostics },
  };
}

export function validateTaskStateBootstrapReceipt(input: {
  receipt: TaskStateBootstrapReceipt;
  generationFile: string;
  projectId: string;
}): TaskStateCheckpointPayload {
  const receipt = input.receipt;
  // WHAT: Reject a malformed, cross-project, or internally inconsistent worker receipt.
  // WHY: Main-thread authority may be installed only from the exact successful project worker response.
  if (
    receipt?.version !== 1
    || receipt.projectId !== input.projectId
    || receipt.payload?.version !== 2
    || receipt.payload.projectId !== input.projectId
    || receipt.generation !== receipt.payload.generation
    || receipt.checksum !== payloadChecksum(receipt.payload)
  ) throw new Error('invalid_task_state_bootstrap_receipt');
  assertGeneration(receipt.generation);
  const generation = readGeneration({ file: input.generationFile, projectId: input.projectId });
  // WHAT: Reject a worker receipt superseded before main-thread installation.
  // WHY: A mutation that advances the compact marker invalidates every earlier in-memory snapshot.
  if (generation.generation !== receipt.generation) throw new Error('stale_task_state_bootstrap_receipt');
  assertPayload(receipt.payload, input.projectId);
  return receipt.payload;
}

export function readTaskStateCheckpoint(input: {
  file: string;
  generationFile: string;
  projectId: string;
  legacyWitness: () => TaskStateCheckpointWitness;
}):
  | { status: 'missing' }
  | { status: 'invalid'; error: string; preserve: boolean; generation?: string }
  | { status: 'valid'; legacy: boolean; payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload } {
  // WHAT: Select canonical reconstruction when no checkpoint has been populated yet.
  // WHY: Existing projects require no migration before gaining the optimization.
  if (!existsSync(input.file)) return { status: 'missing' };
  try {
    const document = JSON.parse(readFileSync(input.file, 'utf8')) as CheckpointDocument;
    const payload = document?.payload;
    // WHAT: Reject a checkpoint outside its exact project, supported schemas, and checksum.
    // WHY: A cache may never become cross-project task authority or bypass byte-integrity validation.
    if (
      !payload
      || (payload.version !== 1 && payload.version !== 2)
      || payload.projectId !== input.projectId
      || document.checksum !== payloadChecksum(payload)
    ) throw new Error('invalid_task_state_checkpoint');
    // WHAT: Use the recursive witness only for a version-1 compatibility admission.
    // WHY: One successful legacy restart upgrades the cache to constant-work generation validation.
    if (payload.version === 1) {
      // WHAT: Reject a legacy checkpoint after any canonical descendant changed.
      // WHY: Version 1 predates the explicit generation marker and must retain its original stale-state proof.
      if (JSON.stringify(payload.witness) !== JSON.stringify(input.legacyWitness())) throw new Error('stale_task_state_checkpoint');
      assertPayload(payload, input.projectId);
      return { status: 'valid', legacy: true, payload };
    }
    assertGeneration(payload.generation);
    const generation = readGeneration({ file: input.generationFile, projectId: input.projectId });
    // WHAT: Reject a version-2 checkpoint whose constant-work witness moved.
    // WHY: Every canonical mutation advances the marker before it can create durable journal authority.
    if (generation.generation !== payload.generation) throw new Error('stale_task_state_checkpoint');
    assertPayload(payload, input.projectId);
    return { status: 'valid', legacy: false, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let generation = '';
    // WHAT: Recover a valid compact witness independently from invalid checkpoint bytes.
    // WHY: Canonical reconstruction may transfer safely without rewriting the preserved checkpoint.
    try {
      generation = readGeneration({ file: input.generationFile, projectId: input.projectId }).generation;
    } catch {
      // WHAT: Leave the optional generation absent when its own marker is unavailable or invalid.
      // WHY: Invalid generation bytes cannot authorize a worker handoff and must remain untouched.
    }
    // WHAT: Include the independently valid generation only when it was admitted.
    // WHY: An absent property cannot accidentally authorize a snapshot after marker corruption.
    return {
      status: 'invalid',
      error: message,
      preserve: message !== 'stale_task_state_checkpoint' && message !== 'missing_task_state_generation',
      ...(generation ? { generation } : {}),
    };
  }
}
