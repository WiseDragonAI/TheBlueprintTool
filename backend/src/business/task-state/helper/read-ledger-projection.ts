/**
 * WHAT: Reads the authoritative in-memory task projection and filesystem-backed non-task ledgers.
 * WHY: Task mutations no longer rewrite the offline-migration source document.
 */
import { existsSync, readFileSync } from 'node:fs';

type AnyRecord = Record<string, unknown>;

export function hasLedgerProjectionSource(input: { ledgerId: string; ledgerPath: string; runtime?: AnyRecord }): boolean {
  return input.ledgerId === 'tasks'
    ? typeof input.runtime?.readTaskLedgerProjection === 'function'
    : existsSync(input.ledgerPath);
}

export function readLedgerProjection(input: { ledgerId: string; ledgerPath: string; runtime?: AnyRecord }): AnyRecord {
  if (input.ledgerId === 'tasks') {
    if (typeof input.runtime?.readTaskLedgerProjection !== 'function') throw new Error('task_state_runtime_authority_required');
    return structuredClone((input.runtime.readTaskLedgerProjection as () => AnyRecord)());
  }
  return JSON.parse(readFileSync(input.ledgerPath, 'utf8')) as AnyRecord;
}
