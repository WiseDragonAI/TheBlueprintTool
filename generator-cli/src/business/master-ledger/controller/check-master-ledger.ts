/**
 * WHAT: MasterLedger check controller.
 * WHY: operators and agents need a report proving parser counts and structural problems before generation.
 */
import type { FileSystemPort, MasterLedgerCheckReport, Result, SpecsLedger } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { parseJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { readMasterLedger } from '../helper/read-master-ledger.js';
import { parseFunctionBatch } from '../helper/parse-function-batch.js';
import { analyzeMasterLedger } from '../helper/analyze-master-ledger.js';

export async function checkMasterLedgerController(input: {
  masterLedgerFile: string;
  specsLedgerFile: string;
  groups?: string[];
}, fs?: FileSystemPort): Promise<Result<MasterLedgerCheckReport>> {
  const { masterLedgerFile, specsLedgerFile, groups = [] } = input;
  const document = await readMasterLedger(masterLedgerFile, fs);
  telemetry('read-master-ledger', { path: masterLedgerFile });

  // WHY: the checker cannot analyze a document it cannot read.
  // WHAT: return the read failure.
  if (!document.ok) {
    return document;
  }

  let specsLedger: SpecsLedger;

  try {
    const fileSystem = fs ?? nodeFileSystem;
    const specsText = await fileSystem.readFile(specsLedgerFile);
    const parsedSpecs = parseJson<SpecsLedger>(specsText);

    // WHY: spec matching requires a valid SpecsLedger JSON document.
    // WHAT: reject invalid SpecsLedger JSON.
    if (!parsedSpecs.ok) {
      return { ok: false, error: parsedSpecs.error };
    }

    specsLedger = parsedSpecs.value;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${specsLedgerFile}` };
  }

  const batch = parseFunctionBatch(document.value);
  telemetry('parse-function-batch', { functions: batch.functions.length, suites: batch.suites.length });
  const report = analyzeMasterLedger(document.value, batch, specsLedger, groups);
  telemetry('check-master-ledger', { ok: report.ok, problems: report.problems.length });
  return { ok: true, value: report };
}
