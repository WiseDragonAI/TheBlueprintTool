/**
 * WHAT: Unit test file derivation for GeneratedFunction records.
 * WHY: every generated function must receive one dedicated unit test file.
 */
import type { GeneratedFunction, OutputFile } from '../../../lib/types.js';
import { dashToCamel, relativeImport } from '../../../lib/name.js';

function testPathFor(generatedFunction: GeneratedFunction): string {
  return `test/unit/${generatedFunction.domain}/${generatedFunction.kind}/${generatedFunction.name}.test.ts`;
}

export function deriveUnitTestFilePath(functions: GeneratedFunction[]): OutputFile[] {
  return functions.map((generatedFunction) => {
    const testPath = testPathFor(generatedFunction);
    const importPath = relativeImport(testPath, generatedFunction.path);
    const exportName = dashToCamel(generatedFunction.name);

    return {
      path: testPath,
      functionName: generatedFunction.name,
      kind: 'test',
      content: `/**
 * WHAT: Unit test for generated function ${generatedFunction.name}.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ${exportName} } from '${importPath}';

test('${generatedFunction.name} returns generated execution output', async () => {
  const result = await ${exportName}({ ok: true });
  assert.equal(result.functionName, '${generatedFunction.name}');
});
`,
    };
  });
}
