/**
 * WHAT: Generated controller function verify-typescript-project.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { readTypescriptProjectConfig } from '../helper/read-typescript-project-config.js';
import { verifyTypescriptSourceFiles } from '../helper/verify-typescript-source-files.js';


export async function verifyTypescriptProjectController({
  action_payload,
}: {
  action_payload: {
    master_ledger_file: string
  }
}) {
  telemetry('controller:verify-typescript-project -> start', { functionName: 'verify-typescript-project', arguments: { action_payload }, phase: 'started' });
  telemetry('controller:verify-typescript-project -> read-typescript-project-config', { functionName: 'read-typescript-project-config', arguments: { action_payload }, phase: 'event' })

  // WHAT: verify TypeScript project truth.
  // WHY: generator-cli implementation files must be TypeScript.
  // HOW: read tsconfig and inspect planned source and test files.
  const tsconfig = await readTypescriptProjectConfig()
  const verification = await verifyTypescriptSourceFiles({
    root_block: 'generator-cli',
    master_ledger_file: action_payload.master_ledger_file,
    tsconfig,
  })

  telemetry('controller:verify-typescript-project -> verify-typescript-source-files', { functionName: 'verify-typescript-source-files', arguments: { action_payload }, phase: 'event' })

  if (!verification.ok) {
    telemetry('controller:verify-typescript-project -> verify-typescript-project-rejected', { functionName: 'verify-typescript-project-rejected', arguments: { action_payload }, phase: 'event' })
    return
  }

  telemetry('controller:verify-typescript-project -> verify-typescript-project-completed', { functionName: 'verify-typescript-project-completed', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:verify-typescript-project -> complete', { functionName: 'verify-typescript-project', arguments: { action_payload }, phase: 'completed' });
}
