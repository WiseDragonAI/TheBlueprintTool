import { basename, dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { createProjectTaskState } from './project-task-state.js';
import type { TaskProjectionCommand } from './task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

/** Routes task aggregate writes through the event authority while leaving non-task ledgers unchanged. */
export function persistLedgerProjection(input: {
  ledgerPath: string;
  ledger: AnyRecord;
  ledgerId?: string;
  decisionOsRoot?: string;
  runtime?: AnyRecord;
  command?: TaskProjectionCommand;
}): AnyRecord {
  stripHydratedThreadNotes(input.ledger);
  const isTaskLedger = input.ledgerId === 'tasks' || basename(input.ledgerPath) === 'tasks.json';
  if (!isTaskLedger) {
    writeFileSync(input.ledgerPath, `${JSON.stringify(input.ledger, null, 2)}\n`, 'utf8');
    return input.ledger;
  }
  if (!input.command) throw new Error('Task projection persistence requires a scoped domain command.');
  const runtimeAuthority = input.runtime?.persistTaskLedgerProjection;
  if (typeof runtimeAuthority === 'function') {
    const result = (runtimeAuthority as (ledger: AnyRecord, command: TaskProjectionCommand) => AnyRecord)(input.ledger, input.command);
    return result.ledger && typeof result.ledger === 'object' && !Array.isArray(result.ledger)
      ? result.ledger as AnyRecord
      : input.ledger;
  }
  const decisionOsRoot = resolve(input.decisionOsRoot ?? dirname(input.ledgerPath));
  const state = createProjectTaskState({
    projectId: String(input.runtime?.projectId ?? basename(dirname(decisionOsRoot))),
    writerId: String(input.runtime?.federationNodeId ?? input.runtime?.projectId ?? 'local-node'),
    decisionOsRoot,
    tasksLedgerFile: input.ledgerPath,
  });
  return state.executeProjectionCommandNow(input.command, input.ledger).ledger;
}
