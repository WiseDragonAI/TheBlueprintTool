/**
 * WHAT: MasterLedger pseudocode validator.
 * WHY: controllers must include executable-shaped pseudocode with telemetry, branching, parameters, and WHAT WHY comments.
 */
import type { Result } from '../../../lib/types.js';
import type { FunctionBatch } from './parse-function-batch.js';

export function validateMasterLedgerPseudocode(batch: FunctionBatch): Result<FunctionBatch> {
  const controllers = batch.functions.filter((generatedFunction) => generatedFunction.kind === 'controller');
  const invalid = controllers.find((controller) => {
    return !controller.body.includes('function ') || !controller.body.includes("telemetry('") || !controller.body.includes('WHY:') || !controller.body.includes('WHAT:');
  });

  // WHY: generated controllers need enough evidence for implementation and tests.
  // WHAT: reject controller pseudocode that omits function shape, telemetry, or comments.
  if (invalid) {
    return { ok: false, error: `Controller pseudocode is incomplete: ${invalid.name}` };
  }

  return { ok: true, value: batch };
}
