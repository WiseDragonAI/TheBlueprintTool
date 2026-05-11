/**
 * WHAT: Function metadata header validator.
 * WHY: MasterLedger functions must contain domain or model, dash-case names, comments, and pseudocode only.
 */
import type { Result } from '../../../lib/types.js';
import type { FunctionBatch } from './parse-function-batch.js';

export function validateFunctionMetadataHeader(batch: FunctionBatch): Result<FunctionBatch> {
  const badName = batch.functions.find((generatedFunction) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(generatedFunction.name));

  // WHY: generated file paths and imports rely on stable dash-case function names.
  // WHAT: reject the batch when any function name is not dash-case.
  if (badName) {
    return { ok: false, error: `Function name is not dash-case: ${badName.name}` };
  }

  const missingDomain = batch.functions.find((generatedFunction) => generatedFunction.domain.length === 0);

  // WHY: generated functions must have business ownership.
  // WHAT: reject the batch when a domain is missing.
  if (missingDomain) {
    return { ok: false, error: `Function domain is missing: ${missingDomain.name}` };
  }

  const nameCounts = new Map<string, number>();

  for (const generatedFunction of batch.functions) {
    nameCounts.set(generatedFunction.name, (nameCounts.get(generatedFunction.name) ?? 0) + 1);
  }

  const duplicateName = [...nameCounts].find(([, count]) => count > 1);

  // WHY: generated function names must be globally unique for imports, tests, reports, and telemetry usage inference.
  // WHAT: reject any MasterLedger that defines the same function name more than once.
  if (duplicateName) {
    return { ok: false, error: `Duplicate generated function name: ${duplicateName[0]}` };
  }

  return { ok: true, value: batch };
}
