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

function literal(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function controllerScaffoldStatements(generatedFunction: GeneratedFunction, functions: GeneratedFunction[]): string[] {
  const byExportName = new Map(functions.map((candidate) => [candidate.exportName, candidate]));
  const statements: string[] = [];

  for (const rawLine of pseudocodeBody(generatedFunction.body).split('\n')) {
    const line = rawLine.trim();
    const telemetryMatch = line.match(/telemetry\('([^']+)'\)/);

    if (telemetryMatch) {
      statements.push(`telemetry('controller:${generatedFunction.name} -> ${literal(telemetryMatch[1])}', { functionName: '${generatedFunction.name}', phase: 'event' });`);
      continue;
    }

    for (const [exportName, target] of byExportName) {
      if (!line.includes(`${exportName}(`)) {
        continue;
      }

      statements.push(`try {
      await ${exportName}({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: '${generatedFunction.name}', dependencyName: '${target.name}', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }`);
      break;
    }
  }

  return statements;
}

function controllerFunctionBody(generatedFunction: GeneratedFunction, functions: GeneratedFunction[]): string {
  const statements = controllerScaffoldStatements(generatedFunction, functions);
  const body = statements.length > 0 ? statements.map((statement) => `    ${statement}`).join('\n') : '    void action_payload;';

  return `export async function ${generatedFunction.exportName}(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:${generatedFunction.name} -> start', { functionName: '${generatedFunction.name}', phase: 'started', arguments: input });

  try {
${body}
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
  const body = generatedFunction.kind === 'controller' ? controllerFunctionBody(generatedFunction, functions) : stubFunctionBody(generatedFunction);

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
