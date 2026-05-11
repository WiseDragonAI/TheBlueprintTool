/**
 * WHAT: Source file path derivation for GeneratedFunction records.
 * WHY: every generated function must have exactly one source file.
 */
import type { GeneratedFunction, OutputFile } from '../../../lib/types.js';
import { dashToCamel, relativeImport } from '../../../lib/name.js';

function generatedFunctionSource(generatedFunction: GeneratedFunction): string {
  const returnValue = generatedFunction.componentOutput
    ? `{ type: 'component-render-output', functionName: '${generatedFunction.name}', input }`
    : `{ functionName: '${generatedFunction.name}', input }`;
  const telemetryImport = relativeImport(generatedFunction.path, 'src/telemetry/harness.ts');

  return `/**
 * WHAT: Generated ${generatedFunction.kind} function ${generatedFunction.name}.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '${telemetryImport}';

export async function ${dashToCamel(generatedFunction.name)}(input: unknown = {}) {
  telemetry('${generatedFunction.telemetryName}', { functionName: '${generatedFunction.name}', arguments: input, phase: 'started' });
  telemetry('${generatedFunction.telemetryName}', { functionName: '${generatedFunction.name}', arguments: input, phase: 'completed' });
  return ${returnValue};
}
`;
}

export function deriveSourceFilePath(functions: GeneratedFunction[]): OutputFile[] {
  return functions.map((generatedFunction) => ({
    path: generatedFunction.path,
    content: generatedFunctionSource(generatedFunction),
    functionName: generatedFunction.name,
    kind: generatedFunction.kind,
  }));
}
