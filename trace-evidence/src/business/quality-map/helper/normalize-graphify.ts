/**
 * WHAT: Normalizes Graphify symbol edges into file dependencies and callable caller/callee links.
 * WHY: Agents need stable repository paths while raw Graphify node payloads remain tool-version specific.
 */
import type { QualityFile } from '../types.js';

type GraphNode = { id?: unknown; source_file?: unknown; name?: unknown; label?: unknown; qualified_name?: unknown };
type GraphEdge = { source?: unknown; target?: unknown };

function normalizedPath(value: unknown): string {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function nodeName(node: GraphNode): string {
  return String(node.name ?? node.qualified_name ?? node.label ?? '');
}

export function applyGraphify(graph: unknown, files: QualityFile[]): void {
  const payload = /* WHAT: Admit only object-shaped Graphify payloads. WHY: Primitive JSON cannot contain graph evidence. */ graph && typeof graph === 'object' ? graph as { nodes?: unknown; edges?: unknown } : {};
  const nodes = /* WHAT: Normalize a valid node array. WHY: Missing nodes must become an explicit empty graph. */ Array.isArray(payload.nodes) ? payload.nodes as GraphNode[] : [];
  const edges = /* WHAT: Normalize a valid edge array. WHY: Missing edges must not crash file inventory. */ Array.isArray(payload.edges) ? payload.edges as GraphEdge[] : [];
  const nodeById = new Map(nodes.map((node) => [String(node.id ?? ''), node]));
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const functionByNode = new Map<string, string>();
  for (const node of nodes) {
    const path = normalizedPath(node.source_file);
    const file = fileByPath.get(path);
    // WHAT: Ignore Graphify symbols that do not resolve to an inventoried file.
    // WHY: External packages cannot own repository quality findings.
    if (!file) continue;
    const name = nodeName(node);
    const matched = file.functions.find((entry) => entry.name === name || name.endsWith(`.${entry.name}`));
    // WHAT: Link only symbols with one explicit name match.
    // WHY: Guessing anonymous or overloaded symbols would corrupt caller queries.
    if (matched) functionByNode.set(String(node.id ?? ''), matched.id);
  }
  const functionById = new Map(files.flatMap((file) => file.functions.map((entry) => [entry.id, entry] as const)));
  for (const edge of edges) {
    const sourceNode = nodeById.get(String(edge.source ?? ''));
    const targetNode = nodeById.get(String(edge.target ?? ''));
    // WHAT: Skip malformed edges without two known endpoints.
    // WHY: Partial Graphify records cannot establish a dependency.
    if (!sourceNode || !targetNode) continue;
    const sourcePath = normalizedPath(sourceNode.source_file);
    const targetPath = normalizedPath(targetNode.source_file);
    const sourceFile = fileByPath.get(sourcePath);
    const targetFile = fileByPath.get(targetPath);
    // WHAT: Add only cross-file dependencies owned by the repository inventory.
    // WHY: Same-file containment and external symbols do not describe file coupling.
    if (sourceFile && targetFile && sourceFile !== targetFile) {
      sourceFile.dependencies.push(targetPath);
      targetFile.dependents.push(sourcePath);
    }
    const sourceFunction = functionById.get(functionByNode.get(String(edge.source ?? '')) ?? '');
    const targetFunction = functionById.get(functionByNode.get(String(edge.target ?? '')) ?? '');
    // WHAT: Link callable edges only when both endpoints map exactly.
    // WHY: File dependencies remain useful when Graphify lacks callable names.
    if (sourceFunction && targetFunction && sourceFunction !== targetFunction) {
      sourceFunction.callees.push(targetFunction.id);
      targetFunction.callers.push(sourceFunction.id);
    }
  }
  for (const file of files) {
    file.dependencies = [...new Set(file.dependencies)].sort();
    file.dependents = [...new Set(file.dependents)].sort();
    for (const callable of file.functions) {
      callable.callers = [...new Set(callable.callers)].sort();
      callable.callees = [...new Set(callable.callees)].sort();
    }
  }
}
