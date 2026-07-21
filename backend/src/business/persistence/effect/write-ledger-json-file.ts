/**
 * WHAT: Implements the write-ledger-json-file effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { persistLedgerProjection } from '../../task-state/helper/persist-ledger-projection.js';
import type { TaskProjectionCommand } from '../../task-state/helper/task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

export async function writeLedgerJsonFile(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<void> {
  telemetry('write-ledger-json-file', { role: 'effect', action: 'write-ledger-json-file' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const document = payload.document ?? payload.patch ?? payload;
  runtime.lastLedgerDocument = document;
  if (payload.mode !== 'dry-run' && payload.ledgerFile) {
    const file = resolve(String(payload.ledgerFile));
    mkdirSync(dirname(file), { recursive: true });
    if (file.endsWith('/tasks.json') && document && typeof document === 'object' && !Array.isArray(document)) {
      await persistLedgerProjection({
        decisionOsRoot: dirname(file),
        ledgerId: 'tasks',
        ledgerPath: file,
        ledger: document as AnyRecord,
        runtime,
        command: payload.taskCommand as TaskProjectionCommand | undefined,
      });
    } else writeFileSync(file, JSON.stringify(document, null, 2));
  }
}
