/**
 * WHAT: Unused GeneratedFunction detector.
 * WHY: report mode must identify functions absent from proven integration telemetry stacks.
 */
import type { GeneratedFunction } from '../../../lib/types.js';

export function detectUnusedFunctions(functions: GeneratedFunction[], usedFunctions: string[]): string[] {
  const used = new Set(usedFunctions);
  return functions.map((generatedFunction) => generatedFunction.name).filter((name) => !used.has(name)).sort();
}
