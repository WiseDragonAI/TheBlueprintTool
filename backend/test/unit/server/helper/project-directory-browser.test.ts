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
      { name: 'Alpha', path: 'Alpha', absolutePath: join(root, 'Alpha'), isSymbolicLink: false, hasDecisionOs: true, hasGit: true },
      { name: 'zeta', path: 'zeta', absolutePath: join(root, 'zeta'), isSymbolicLink: false, hasDecisionOs: false, hasGit: false },
    ]);
    assert.equal(listProjectDirectories({ masterRoot: root, path: 'Alpha' }).parentPath, '.');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('follows directory symbolic links while rejecting traversal, broken links, files, and cycles', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-directory-boundary-'));
  const outside = mkdtempSync(join(tmpdir(), 'decision-os-directory-outside-'));
  try {
    mkdirSync(join(outside, 'Nested'));
    writeFileSync(join(outside, 'file.txt'), 'not a directory');
    symlinkSync(outside, join(root, 'outside'));
    symlinkSync(join(outside, 'missing'), join(root, 'broken'));
    symlinkSync(join(outside, 'file.txt'), join(root, 'file-link'));
    symlinkSync(root, join(outside, 'cycle'));
    assert.throws(() => resolveProjectDirectory({ masterRoot: root, path: '..' }), /below the catalog root/);
    const rootListing = listProjectDirectories({ masterRoot: root, path: '.' });
    assert.deepEqual(rootListing.directories, [{
      name: 'outside', path: 'outside', absolutePath: join(root, 'outside'), isSymbolicLink: true,
      hasDecisionOs: false, hasGit: false,
    }]);
    const selected = resolveProjectDirectory({ masterRoot: root, path: 'outside' });
    assert.equal(selected.path, 'outside');
    assert.equal(selected.absolutePath, outside);
    assert.equal(selected.configuredPath, join(root, 'outside'));
    assert.deepEqual(listProjectDirectories({ masterRoot: root, path: 'outside' }).directories, [{
      name: 'Nested', path: 'outside/Nested', absolutePath: join(root, 'outside', 'Nested'), isSymbolicLink: false,
      hasDecisionOs: false, hasGit: false,
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
