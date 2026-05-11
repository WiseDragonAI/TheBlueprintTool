/**
 * WHAT: MasterLedger load and validation controller.
 * WHY: generation paths must consume only readable and validated canonical ledgers.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readMasterLedger } from '../helper/read-master-ledger.js';
import { parseFunctionBatch, type FunctionBatch } from '../helper/parse-function-batch.js';
import { validateFunctionMetadataHeader } from '../helper/validate-function-metadata-header.js';
import { validateMasterLedgerPseudocode } from '../helper/validate-master-ledger-pseudocode.js';

export async function loadAndValidateMasterLedgerController(masterLedgerFile: string, fs?: FileSystemPort): Promise<Result<FunctionBatch>> {
  telemetry('read-master-ledger', { path: masterLedgerFile });
  const masterLedger = await readMasterLedger(masterLedgerFile, fs);

  // WHY: unreadable ledgers cannot drive deterministic generation.
  // WHAT: reject before parsing.
  if (!masterLedger.ok) {
    telemetry('load-and-validate-master-ledger-rejected', { error: masterLedger.error });
    return masterLedger;
  }

  const batch = parseFunctionBatch(masterLedger.value);
  telemetry('parse-function-batch', { functions: batch.functions.length, suites: batch.suites.length });

  const metadata = validateFunctionMetadataHeader(batch);
  telemetry('validate-function-metadata-header');

  const pseudocode = validateMasterLedgerPseudocode(batch);
  telemetry('validate-master-ledger-pseudocode');

  // WHY: either validation failure blocks code generation.
  // WHAT: return the first validation error.
  if (!metadata.ok || !pseudocode.ok) {
    const error = !metadata.ok ? metadata.error : !pseudocode.ok ? pseudocode.error : 'Unknown validation failure';
    telemetry('load-and-validate-master-ledger-rejected', { error });
    return { ok: false, error };
  }

  telemetry('load-and-validate-master-ledger-completed');
  return { ok: true, value: batch };
}
