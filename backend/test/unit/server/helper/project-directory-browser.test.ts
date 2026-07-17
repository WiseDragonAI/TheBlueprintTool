import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listProjectDirectories, resolveProjectDirectory } from '@backend/business/server/helper/project-directory-browser.js';

test('lists one directory level with project metadata and stable ordering', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-directory-browser-'));
  try {
    mkdirSync(join(root, 'zeta'));
    mkdirSync(join(root, 'Alpha', '.decision-os'), { recursive: true });
    writeFileSync(join(root, 'Alpha', '.decision-os', 'state.json'), '{}');
    mkdirSync(join(root, 'Alpha', '.git'));
    mkdirSync(join(root, '.hidden'));
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'file.txt'), 'not a directory');

    const listing = listProjectDirectories({ masterRoot: root, path: '.' });

    assert.equal(listing.path, '.');
    assert.equal(listing.absolutePath, root);
    assert.equal(listing.parentPath, null);
    assert.deepEqual(listing.directories, [
      { name: 'Alpha', path: 'Alpha', hasDecisionOs: true, hasGit: true },
      { name: 'zeta', path: 'zeta', hasDecisionOs: false, hasGit: false },
    ]);
    assert.equal(listProjectDirectories({ masterRoot: root, path: 'Alpha' }).parentPath, '.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects traversal and symbolic-link directory selection', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-directory-boundary-'));
  const outside = mkdtempSync(join(tmpdir(), 'decision-os-directory-outside-'));
  try {
    symlinkSync(outside, join(root, 'outside'));
    assert.throws(() => resolveProjectDirectory({ masterRoot: root, path: '..' }), /below the catalog root/);
    assert.throws(() => resolveProjectDirectory({ masterRoot: root, path: 'outside' }), /Symbolic-link directories/);
    assert.deepEqual(listProjectDirectories({ masterRoot: root, path: '.' }).directories, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
