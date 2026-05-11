/**
 * WHAT: Spec 1b28c191 test for patch-doc mode.
 * WHY: patch-doc mode must apply a patch batch file to a canonical document.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPatchDocController } from '../../src/index.js';
import { createPatchFixture, readText } from '../fixture/scenario.js';

test('Patch-doc mode applies a patch batch file to a canonical master document', async () => {
  const fixture = await createPatchFixture();
  const result = await applyPatchDocController(fixture.patchBatchFile);
  assert.equal(result.ok, true);
  assert.equal(await readText(fixture.documentPath), 'after\n');
});
