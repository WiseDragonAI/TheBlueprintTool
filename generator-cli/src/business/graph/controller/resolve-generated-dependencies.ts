/**
 * WHAT: Generated controller function resolve-generated-dependencies.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { buildDependencyGraph } from '../helper/build-dependency-graph.js';
import { discoverDependencyReferences } from '../helper/discover-dependency-references.js';
import { resolveImportPaths } from '../helper/resolve-import-paths.js';
import { writeDependencyGraphOutput } from '../../generate/effect/write-dependency-graph-output.js';


export async function resolveGeneratedDependenciesController({
  action_payload,
}: {
  action_payload: {
    master_ledger_file: string
  }
}) {
  telemetry('controller:resolve-generated-dependencies -> start', { functionName: 'resolve-generated-dependencies', arguments: { action_payload }, phase: 'started' });
  // WHAT: resolve generated dependencies automatically.
  // WHY: the agent must not specify dependency import paths manually.
  // HOW: parse function bodies, discover references, resolve imports, and write graph output.
  const references = discoverDependencyReferences(action_payload.master_ledger_file)
  telemetry('controller:resolve-generated-dependencies -> discover-dependency-references', { functionName: 'discover-dependency-references', arguments: { action_payload }, phase: 'event' })

  const imports = resolveImportPaths(references)
  telemetry('controller:resolve-generated-dependencies -> resolve-import-paths', { functionName: 'resolve-import-paths', arguments: { action_payload }, phase: 'event' })

  const graph = buildDependencyGraph(imports)
  telemetry('controller:resolve-generated-dependencies -> build-dependency-graph', { functionName: 'build-dependency-graph', arguments: { action_payload }, phase: 'event' })

  writeDependencyGraphOutput(graph)
  telemetry('controller:resolve-generated-dependencies -> write-dependency-graph-output', { functionName: 'write-dependency-graph-output', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:resolve-generated-dependencies -> complete', { functionName: 'resolve-generated-dependencies', arguments: { action_payload }, phase: 'completed' });
}
