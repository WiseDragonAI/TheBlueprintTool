/**
 * WHAT: Unit test file derivation for GeneratedFunction records.
 * WHY: every generated function must receive one dedicated unit test file.
 */
import type { GeneratedFunction, OutputFile } from '../../../lib/types.js';

function testPathFor(generatedFunction: GeneratedFunction): string {
  return `generator-cli/test/unit/${generatedFunction.domain}/${generatedFunction.kind}/${generatedFunction.name}.test.ts`;
}

export function deriveUnitTestFilePath(functions: GeneratedFunction[]): OutputFile[] {
  return functions.map((generatedFunction) => {
    const testPath = testPathFor(generatedFunction);

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

test('${generatedFunction.name} requires implementation before validation', () => {
  assert.equal(true, false, 'Generated scaffold unit tests must stay red until this function is implemented.');
});
`,
    };
  });
}
