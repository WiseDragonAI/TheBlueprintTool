/**
 * WHAT: Import path resolver for discovered dependencies.
 * WHY: agents must not manually specify dependency import paths during generation.
 */
import type { DependencyReference, GeneratedFunction } from '../../../lib/types.js';
import { relativeImport } from '../../../lib/name.js';

export function resolveImportPaths(references: DependencyReference[], functions: GeneratedFunction[]): DependencyReference[] {
  const byName = new Map(functions.map((generatedFunction) => [generatedFunction.name, generatedFunction]));

  return references.map((reference) => {
    const from = byName.get(reference.from);
    const to = byName.get(reference.to);

    // WHY: unresolved edges cannot produce safe import paths.
    // WHAT: keep the existing path when either function is unavailable.
    if (!from || !to) {
      return reference;
    }

    return { ...reference, importPath: relativeImport(from.path, to.path) };
  });
}
