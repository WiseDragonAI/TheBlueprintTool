/**
 * WHAT: Routes ledger writes through scoped asynchronous persistence.
 * WHY: Task commands must await journal durability without blocking the Node.js event loop.
 */
import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import type { TaskProjectionCommand } from './task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

export async function persistLedgerProjection(input: {
  ledgerPath: string;
  ledger: AnyRecord;
  ledgerId?: string;
  decisionOsRoot?: string;
  runtime?: AnyRecord;
  command?: TaskProjectionCommand;
}): Promise<AnyRecord> {
  stripHydratedThreadNotes(input.ledger);
  const isTaskLedger = input.ledgerId === 'tasks' || basename(input.ledgerPath) === 'tasks.json';
  if (!isTaskLedger) {
    writeFileSync(input.ledgerPath, `${JSON.stringify(input.ledger, null, 2)}\n`, 'utf8');
    return input.ledger;
  }
  if (!input.command) throw new Error('Task projection persistence requires a scoped domain command.');
  const runtimeAuthority = input.runtime?.persistTaskLedgerProjection;
  if (typeof runtimeAuthority === 'function') {
    const result = await (runtimeAuthority as (ledger: AnyRecord, command: TaskProjectionCommand) => Promise<AnyRecord>)(input.ledger, input.command);
    return result.ledger && typeof result.ledger === 'object' && !Array.isArray(result.ledger)
      ? result.ledger as AnyRecord
      : input.ledger;
  }
  throw new Error('task_state_runtime_authority_required');
}

export function queueLedgerProjectionPersistence(input: Parameters<typeof persistLedgerProjection>[0]): void {
  const queued = { ...input, ledger: structuredClone(input.ledger), ...(input.command ? { command: structuredClone(input.command) } : {}) };
  void persistLedgerProjection(queued).catch((error: unknown) => {
    if (input.runtime) input.runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error);
  });
}
