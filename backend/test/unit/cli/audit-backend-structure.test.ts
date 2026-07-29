/**
 * WHAT: Verifies repeatable backend structural reporting.
 * WHY: The migration needs stable evidence for oversized files and import cycles without ad hoc scripts.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { auditBackendStructure } from '../../../src/cli/audit-backend-structure.js';

test('reports oversized files and dependency cycles deterministically', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'decision-os-backend-structure-'));
  mkdirSync(resolve(root, 'feature'), { recursive: true });
  writeFileSync(resolve(root, 'feature', 'a.ts'), [
    "import { b } from './b.js';",
    'export const a = b;',
    '',
  ].join('\n'));
  writeFileSync(resolve(root, 'feature', 'b.ts'), [
    "import { a } from './a.js';",
    'export const b = a;',
    '',
  ].join('\n'));

  const report = auditBackendStructure({ sourceRoot: root, oversizedLineCount: 2 });

  assert.deepEqual(report.oversizedFiles.map((file) => file.file), ['feature/a.ts', 'feature/b.ts']);
  assert.deepEqual(report.cycles, [['feature/a.ts', 'feature/b.ts']]);
  assert.deepEqual(report.files.map((file) => file.file), ['feature/a.ts', 'feature/b.ts']);
});
