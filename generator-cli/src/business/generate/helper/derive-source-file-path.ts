/**
 * WHAT: Source file path derivation for GeneratedFunction records.
 * WHY: every generated function must have exactly one source file.
 */
import type { DependencyReference, GeneratedFunction, OutputFile } from '../../../lib/types.js';

function sourceAlias(path: string): string {
  return `@generator-cli/${path.replace(/^(?:generator-cli\/)?src\//, '').replace(/\.ts$/, '.js')}`;
}

function dependencyImports(generatedFunction: GeneratedFunction, functions: GeneratedFunction[], edges: DependencyReference[]): string {
  const byName = new Map(functions.map((candidate) => [candidate.name, candidate]));

  return edges
    .filter((edge) => edge.from === generatedFunction.name)
    .flatMap((edge) => {
      const target = byName.get(edge.to);
      return target ? [`import { ${target.exportName} } from '${sourceAlias(target.path)}';`] : [];
    })
    .join('\n');
}

function pseudocodeBody(body: string): string {
  const bodyStart = body.match(/\}\)\s*\{/);

  if (bodyStart) {
    return body.slice((bodyStart.index ?? 0) + bodyStart[0].length, body.lastIndexOf('}')).trim();
  }

  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  return firstBrace === -1 || lastBrace === -1 ? body.trim() : body.slice(firstBrace + 1, lastBrace).trim();
}

function explicitTelemetryBody(generatedFunction: GeneratedFunction): string {
  return pseudocodeBody(generatedFunction.body).replaceAll(/telemetry\('([^']+)'\)/g, (_match, eventName: string) => {
    return `telemetry('controller:${generatedFunction.name} -> ${eventName}', { functionName: '${generatedFunction.name}', phase: 'event' })`;
  });
}

function controllerFunctionBody(generatedFunction: GeneratedFunction): string {
  return `export async function ${generatedFunction.exportName}(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:${generatedFunction.name} -> start', { functionName: '${generatedFunction.name}', phase: 'started', arguments: input });

  try {
${explicitTelemetryBody(generatedFunction).split('\n').map((line) => `    ${line}`).join('\n')}
  } finally {
    telemetry('controller:${generatedFunction.name} -> complete', { functionName: '${generatedFunction.name}', phase: 'completed', arguments: input });
  }
}`;
}

function stubFunctionBody(generatedFunction: GeneratedFunction): string {
  const telemetryPrefix = generatedFunction.kind;
  const returnType = generatedFunction.returnType ?? 'void';

  return `export function ${generatedFunction.exportName}(input: unknown = {}, ...args: unknown[]): ${returnType} {
  telemetry('${telemetryPrefix}:${generatedFunction.name} -> stubbed scaffold return', { functionName: '${generatedFunction.name}', phase: 'event', arguments: input });
}`;
}

function generatedFunctionSource(generatedFunction: GeneratedFunction, functions: GeneratedFunction[], edges: DependencyReference[]): string {
  const imports = dependencyImports(generatedFunction, functions, edges);
  const body = generatedFunction.kind === 'controller' ? controllerFunctionBody(generatedFunction) : stubFunctionBody(generatedFunction);

  const tsNoCheck = generatedFunction.kind === 'controller' || generatedFunction.returnType !== 'void' ? '// @ts-nocheck\n' : '';

  return `${tsNoCheck}/**
 * WHAT: Generated ${generatedFunction.kind} function ${generatedFunction.name}.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '${sourceAlias('generator-cli/src/telemetry/harness.ts')}';
${imports ? `${imports}\n` : ''}
${body}
`;
}

export function deriveSourceFilePath(functions: GeneratedFunction[], edges: DependencyReference[] = []): OutputFile[] {
  return functions.map((generatedFunction) => ({
    path: generatedFunction.path,
    content: generatedFunctionSource(generatedFunction, functions, edges),
    functionName: generatedFunction.name,
    kind: generatedFunction.kind,
  }));
}
