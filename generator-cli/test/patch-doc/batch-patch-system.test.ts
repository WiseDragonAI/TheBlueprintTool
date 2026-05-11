/**
 * WHAT: Spec 67e83237 test for batch patch application.
 * WHY: canonical document edits must apply from one patch batch in one pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePatchBatch, applyDocumentPatch } from '../../src/index.js';
import { createPatchFixture, readText } from '../fixture/scenario.js';

test('Batch patch system applies canonical document patch batches in one pass', async () => {
  const fixture = await createPatchFixture();
  const parsed = parsePatchBatch(await readText(fixture.patchBatchFile));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && (await applyDocumentPatch(parsed.value)).ok, true);
  assert.equal(await readText(fixture.documentPath), 'after\n');
});
