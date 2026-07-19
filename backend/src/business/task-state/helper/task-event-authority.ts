import { randomUUID } from 'node:crypto';
import { createTaskFieldEvent } from './task-event-codec.js';
import type { TaskFieldChange, TaskFieldEvent, TaskEntityType } from './task-event-types.js';
import type { TaskEventStore } from './task-event-store.js';

type SubmitInput = {
  entityType: TaskEntityType;
  entityId: string;
  changes: TaskFieldChange[];
  emittedAt?: string;
};

/** Serializes every local caller through one persist-before-effect issuer. */
export function createTaskEventAuthority(input: { projectId: string; writerId: string; store: TaskEventStore; publish?: (event: TaskFieldEvent) => void | Promise<void> }) {
  let queue = Promise.resolve();
  const submit = (mutation: SubmitInput): Promise<TaskFieldEvent> => {
    let resolveEvent: (event: TaskFieldEvent) => void = () => undefined;
    let rejectEvent: (error: unknown) => void = () => undefined;
    const result = new Promise<TaskFieldEvent>((resolve, reject) => { resolveEvent = resolve; rejectEvent = reject; });
    queue = queue.then(async () => {
      const event = createTaskFieldEvent({
        eventId: randomUUID(),
        projectId: input.projectId,
        writerId: input.writerId,
        emittedAt: mutation.emittedAt ?? new Date().toISOString(),
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        changes: mutation.changes,
      });
      input.store.append(event);
      await input.publish?.(event);
      resolveEvent(event);
    }).catch((error) => { rejectEvent(error); });
    return result;
  };
  return { submit, projection: () => input.store.projection() };
}

export type TaskEventAuthority = ReturnType<typeof createTaskEventAuthority>;

