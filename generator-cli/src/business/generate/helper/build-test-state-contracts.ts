/**
 * WHAT: RuntimeData state contract builder for generated tests.
 * WHY: generated tests must carry explicit previous state and next state contracts.
 */
import type { GeneratedFunction } from '../../../lib/types.js';

export type TestStateContract = {
  functionName: string;
  previousState: Record<string, unknown>;
  nextState: Record<string, unknown>;
};

export function buildTestStateContracts(functions: GeneratedFunction[]): TestStateContract[] {
  return functions.map((generatedFunction) => ({
    functionName: generatedFunction.name,
    previousState: { functionName: generatedFunction.name, phase: 'before' },
    nextState: { functionName: generatedFunction.name, phase: 'after' },
  }));
}
