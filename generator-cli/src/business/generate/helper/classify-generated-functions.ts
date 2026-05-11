/**
 * WHAT: GeneratedFunction classifier.
 * WHY: tests and reports distinguish pure behavior, IO effects, components, and controllers.
 */
import type { GeneratedFunction } from '../../../lib/types.js';

export function classifyGeneratedFunctions(functions: GeneratedFunction[]): GeneratedFunction[] {
  return functions.map((generatedFunction) => ({
    ...generatedFunction,
    pure: generatedFunction.kind === 'helper',
    componentOutput: generatedFunction.kind === 'component',
  }));
}
