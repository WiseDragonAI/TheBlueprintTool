/**
 * WHAT: Generated function dependency discovery.
 * WHY: imports and dependency graph output must be derived automatically from function bodies.
 */
import type { DependencyReference, GeneratedFunction } from '../../../lib/types.js';

export function discoverDependencyReferences(functions: GeneratedFunction[]): DependencyReference[] {
  const byExportName = new Map(functions.map((generatedFunction) => [generatedFunction.exportName, generatedFunction]));
  const references: DependencyReference[] = [];

  for (const generatedFunction of functions) {
    for (const [exportName, target] of byExportName) {
      // WHY: a function should not import itself as a dependency.
      // WHAT: skip self references before scanning body text.
      if (target.name === generatedFunction.name) {
        continue;
      }

      // WHY: call references in pseudocode/source define executable dependencies.
      // WHAT: add an edge when a known export is invoked.
      if (generatedFunction.body.includes(`${exportName}(`)) {
        references.push({ from: generatedFunction.name, to: target.name, importPath: target.path });
      }
    }
  }

  return references;
}
