/**
 * WHAT: GeneratedFunction enumerator.
 * WHY: source, tests, graph, telemetry, and report paths all start from the same function list.
 */
import type { GeneratedFunction } from '../../../lib/types.js';
import type { FunctionBatch } from '../../master-ledger/helper/parse-function-batch.js';

export function enumerateGeneratedFunctions(batch: FunctionBatch): GeneratedFunction[] {
  return [...batch.functions].sort((left, right) => left.path.localeCompare(right.path));
}
