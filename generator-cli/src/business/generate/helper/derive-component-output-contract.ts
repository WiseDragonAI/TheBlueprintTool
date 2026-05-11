/**
 * WHAT: Component output contract derivation.
 * WHY: generated component functions must expose render output for tests.
 */
import type { GeneratedFunction } from '../../../lib/types.js';

export function deriveComponentOutputContract(functions: GeneratedFunction[]): GeneratedFunction[] {
  return functions.map((generatedFunction) => ({
    ...generatedFunction,
    componentOutput: generatedFunction.kind === 'component' || generatedFunction.componentOutput === true,
  }));
}
