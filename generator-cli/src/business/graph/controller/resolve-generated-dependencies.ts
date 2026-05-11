/**
 * WHAT: Dependency resolution controller.
 * WHY: generated imports and dependency graph output must be automatic.
 */
import type { DependencyGraph, GeneratedFunction } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { discoverDependencyReferences } from '../helper/discover-dependency-references.js';
import { resolveImportPaths } from '../helper/resolve-import-paths.js';
import { buildDependencyGraph } from '../helper/build-dependency-graph.js';

export function resolveGeneratedDependenciesController(functions: GeneratedFunction[]): DependencyGraph {
  const references = discoverDependencyReferences(functions);
  telemetry('discover-dependency-references', { count: references.length });
  const imports = resolveImportPaths(references, functions);
  telemetry('resolve-import-paths', { count: imports.length });
  const graph = buildDependencyGraph(functions, imports);
  telemetry('build-dependency-graph', { nodes: graph.nodes.length, edges: graph.edges.length });
  return graph;
}
