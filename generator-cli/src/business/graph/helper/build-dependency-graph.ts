/**
 * WHAT: Dependency graph builder.
 * WHY: generator-cli must output how generated functions call each other through executable paths.
 */
import type { DependencyGraph, DependencyReference, GeneratedFunction } from '../../../lib/types.js';

export function buildDependencyGraph(functions: GeneratedFunction[], edges: DependencyReference[]): DependencyGraph {
  return {
    nodes: functions.map((generatedFunction) => generatedFunction.name).sort(),
    edges: [...edges].sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)),
  };
}
