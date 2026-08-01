import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ReferenceNodeAdapter } from '../../src/business/adapter/reference-node-adapter.js';

test('reference Node adapter preserves batch identities and discovers exact build maps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-reference-')); await mkdir(join(root, 'dist')); await writeFile(join(root, 'dist/app.js.map'), '{}');
  const adapter = new ReferenceNodeAdapter(root);
  const commands = await adapter.discoverTests({ files: ['b.test.js', 'a.test.js'], names: [], command: [process.execPath, '--test'], cwd: root });
  assert.deepEqual(commands.map((command) => command.testId), ['b.test.js', 'a.test.js']);
  assert.deepEqual(await adapter.locateSourceMaps({ scopes: [], generatedFiles: [join(root, 'dist/app.js')] }), [join(root, 'dist/app.js.map')]);
  await assert.rejects(adapter.resolveCards({ projectId: '', cardIds: [] }), /unsupported_capability:cards/);
});
