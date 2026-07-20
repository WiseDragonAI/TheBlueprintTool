import { createHash } from 'node:crypto';
import type { TaskFieldEvent, TaskFieldChange, TaskStateSnapshot } from './task-event-types.js';

const forbiddenFieldParts = new Set(['description', 'what', 'notes', 'deletedNoteIds', 'content', 'contentBytes', 'markdown']);
const allowedOperations = new Set(['set', 'add', 'remove', 'tombstone']);
const allowedEntityTypes = new Set(['ledger', 'card', 'annotation', 'relationship']);

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertChange(change: TaskFieldChange): void {
  if (!change || typeof change !== 'object') throw new Error('invalid_task_event_change');
  if (typeof change.path !== 'string' || !change.path || change.path.startsWith('/') || change.path.endsWith('/')) throw new Error('invalid_task_event_path');
  const parts = change.path.split('/');
  if (parts.some((part) => !part || forbiddenFieldParts.has(part))) throw new Error('task_event_content_forbidden');
  if (!allowedOperations.has(change.operation)) throw new Error('invalid_task_event_operation');
  if ((change.operation === 'set' || change.operation === 'add') && !Object.hasOwn(change, 'value')) throw new Error('task_event_value_required');
  if ((change.operation === 'remove' || change.operation === 'tombstone') && Object.hasOwn(change, 'value')) throw new Error('task_event_value_forbidden');
}

export function eventBody(event: Omit<TaskFieldEvent, 'checksum'> | TaskFieldEvent): Omit<TaskFieldEvent, 'checksum'> {
  const { checksum: _checksum, ...body } = event as TaskFieldEvent;
  return body;
}

export function taskEventChecksum(event: Omit<TaskFieldEvent, 'checksum'> | TaskFieldEvent): string {
  return sha256(canonicalJson(eventBody(event)));
}

export function createTaskFieldEvent(event: Omit<TaskFieldEvent, 'checksum'>): TaskFieldEvent {
  const value: TaskFieldEvent = { ...event, checksum: '' };
  value.checksum = taskEventChecksum(value);
  assertTaskFieldEvent(value);
  return value;
}

export function assertTaskFieldEvent(event: TaskFieldEvent): void {
  if (!event || typeof event !== 'object') throw new Error('invalid_task_event');
  if (typeof event.eventId !== 'string' || !event.eventId) throw new Error('invalid_task_event_id');
  if (typeof event.projectId !== 'string' || !event.projectId) throw new Error('invalid_task_event_project');
  if (typeof event.writerId !== 'string' || !event.writerId) throw new Error('invalid_task_event_writer');
  if (typeof event.emittedAt !== 'string' || !event.emittedAt || !Number.isFinite(Date.parse(event.emittedAt))) throw new Error('invalid_task_event_date');
  if (event.revision !== undefined && (!Number.isSafeInteger(event.revision) || event.revision < 1)) throw new Error('invalid_task_event_revision');
  if (!allowedEntityTypes.has(event.entityType)) throw new Error('invalid_task_event_entity_type');
  if (typeof event.entityId !== 'string' || !event.entityId) throw new Error('invalid_task_event_entity_id');
  if (!Array.isArray(event.changes) || event.changes.length === 0) throw new Error('invalid_task_event_changes');
  for (const change of event.changes) assertChange(change);
  if (event.checksum !== taskEventChecksum(event)) throw new Error('invalid_task_event_checksum');
  if (Object.hasOwn(event as object, 'sequence')) throw new Error('task_event_sequence_forbidden');
}

export function snapshotBody(snapshot: TaskStateSnapshot): Buffer {
  return Buffer.from(canonicalJson(snapshot.projection));
}
