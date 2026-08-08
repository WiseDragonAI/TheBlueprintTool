import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildMeaningfulFileMap,
} from '@backend/business/codex/helper/build-meaningful-file-map.js';
import { meaningfulGitPaths } from '../../../shared/meaningful-file-map.mjs';
import { runFileMapCli } from '../../../tools/map.mjs';

function write(workspace: string, relativeFile: string, content = ''): void {
  const file = join(workspace, relativeFile);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

test('injected file map cuts tests and documentation, ranks five code files per directory, and exposes domains', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-file-map-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: workspace });
    write(workspace, '.gitignore', ['ignored/', '*.generated.ts', ''].join('\n'));
    write(workspace, 'README.md');
    write(workspace, 'backend/README.md');
    write(workspace, 'backend/src/index.ts');
    write(workspace, 'backend/src/nested/view.tsx');
    for (let lines = 1; lines <= 7; lines += 1) {
      write(
        workspace,
        `backend/src/top/${['one', 'two', 'three', 'four', 'five', 'six', 'seven'][lines - 1]}.ts`,
        Array.from({ length: lines }, (_, index) => `line ${index + 1}`).join('\n'),
      );
    }
    write(workspace, 'backend/test/index.test.ts');
    write(workspace, 'backend/test-responsive/mobile.ts');
    write(workspace, 'docs/data.json');
    write(workspace, 'docs/guide.md');
    write(workspace, 'tests/root.spec.ts');
    write(workspace, 'backend/src/deleted.ts');
    execFileSync('git', ['add', '.gitignore', 'backend/src/deleted.ts'], { cwd: workspace });
    rmSync(join(workspace, 'backend/src/deleted.ts'));
    write(workspace, 'ignored/secret.ts');
    write(workspace, 'backend/src/schema.generated.ts');
    write(workspace, 'frontend/dist/bundle.js');
    write(workspace, 'frontend/assets/vendor/library.js');
    write(workspace, '.decision-os/cards/card.md');
    write(workspace, '.decision-os-recovery/state.json');
    write(workspace, '.skills/example/SKILL.md');
    write(workspace, 'package-lock.json');
    write(workspace, 'assets/logo.png');

    assert.deepEqual(meaningfulGitPaths(workspace), [
      '.gitignore',
      'README.md',
      'backend/README.md',
      'backend/src/index.ts',
      'backend/src/nested/view.tsx',
      'backend/src/top/five.ts',
      'backend/src/top/four.ts',
      'backend/src/top/one.ts',
      'backend/src/top/seven.ts',
      'backend/src/top/six.ts',
      'backend/src/top/three.ts',
      'backend/src/top/two.ts',
      'backend/test-responsive/mobile.ts',
      'backend/test/index.test.ts',
      'docs/data.json',
      'docs/guide.md',
      'tests/root.spec.ts',
    ]);
    assert.equal(buildMeaningfulFileMap(workspace), [
      'DOMAINS',
      ' backend ctd',
      ' docs d',
      ' tests t',
      'CODE',
      '.',
      ' .gitignore',
      ' backend/',
      '  src/',
      '   index.ts',
      '   nested/',
      '    view.tsx',
      '   top/',
      '    seven.ts',
      '    six.ts',
      '    five.ts',
      '    four.ts',
      '    three.ts',
    ].join('\n'));
    assert.doesNotMatch(buildMeaningfulFileMap(workspace), /[^\x00-\x7f]/);
    assert.doesNotMatch(buildMeaningfulFileMap(workspace), /README|test\/|test-responsive|guide\.md|two\.ts|one\.ts/);
    assert.equal(runFileMapCli(['t', 'backend'], workspace), [
      '.',
      ' test/',
      '  index.test.ts',
      ' test-responsive/',
      '  mobile.ts',
    ].join('\n'));
    assert.equal(runFileMapCli(['doc', 'backend'], workspace), [
      '.',
      ' README.md',
    ].join('\n'));
    assert.equal(runFileMapCli(['d', 'docs'], workspace), [
      '.',
      ' data.json',
      ' guide.md',
    ].join('\n'));
    assert.equal(runFileMapCli(['c', 'backend'], workspace), [
      '.',
      ' src/',
      '  index.ts',
      '  nested/',
      '   view.tsx',
      '  top/',
      '   seven.ts',
      '   six.ts',
      '   five.ts',
      '   four.ts',
      '   three.ts',
      '   two.ts',
      '   one.ts',
    ].join('\n'));
    assert.equal(runFileMapCli(['c', 'backend/src', '1'], workspace), [
      '.',
      ' index.ts',
      ' nested/',
      ' top/',
    ].join('\n'));
    assert.equal(runFileMapCli(['c', 'backend/src', '0'], workspace), '.');
    assert.equal(runFileMapCli(['c', 'backend/src', '2'], workspace), [
      '.',
      ' index.ts',
      ' nested/',
      '  view.tsx',
      ' top/',
      '  seven.ts',
      '  six.ts',
      '  five.ts',
      '  four.ts',
      '  three.ts',
      '  two.ts',
      '  one.ts',
    ].join('\n'));
    assert.throws(() => runFileMapCli(['c', 'missing'], workspace), /unknown base directory: missing/);
    assert.throws(() => runFileMapCli(['c', 'backend', '-1'], workspace), /depth must be a non-negative integer/);
    assert.equal(runFileMapCli([], workspace), buildMeaningfulFileMap(workspace));
    assert.throws(() => runFileMapCli(['unknown'], workspace), /usage: tools\/map\.mjs <c\|t\|d> \[base-directory\] \[depth\]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('meaningful file map stays failsafe outside a Git work tree', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-file-map-no-git-'));
  try {
    assert.equal(
      buildMeaningfulFileMap(workspace),
      'DOMAINS\n (unavailable)\nCODE\n.\n (file map unavailable)',
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
