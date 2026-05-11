/**
 * WHAT: MasterLedger check controller.
 * WHY: operators and agents need parser counts and structural problems before generation.
 */
import type { FileSystemPort, MasterLedgerCheckReport, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readMasterLedger } from '../../master-ledger/helper/read-master-ledger.js';
import { parseFunctionBatch } from '../../master-ledger/helper/parse-function-batch.js';
import { analyzeMasterLedger } from '../helper/analyze-master-ledger.js';
import { readSpecsLedger } from '../helper/read-specs-ledger.js';
import { resolveLedgerGroups } from '../helper/resolve-ledger-groups.js';

export async function checkMasterLedgerController(
  input: {
    masterLedgerFile: string;
    specsLedgerFile: string;
    groups?: string[];
    emit?: (message: string) => void;
  },
  fs?: FileSystemPort,
): Promise<Result<MasterLedgerCheckReport>> {
  const { masterLedgerFile, specsLedgerFile, groups = [] } = input;
  const document = await readMasterLedger(masterLedgerFile, fs);
  telemetry('read-master-ledger', { path: masterLedgerFile });

  if (!document.ok) {
    return document;
  }

  const specsLedger = await readSpecsLedger(specsLedgerFile, fs);
  telemetry('read-specs-ledger', { path: specsLedgerFile });

  if (!specsLedger.ok) {
    return specsLedger;
  }

  const batch = parseFunctionBatch(document.value);
  telemetry('parse-function-batch', { functions: batch.functions.length, suites: batch.suites.length });
  resolveLedgerGroups(specsLedger.value, groups);
  telemetry('resolve-ledger-groups', { groups });
  const report = analyzeMasterLedger(document.value, batch, specsLedger.value, groups);
  telemetry('analyze-master-ledger', { ok: report.ok, problems: report.problems.length });
  return { ok: true, value: report };
}
