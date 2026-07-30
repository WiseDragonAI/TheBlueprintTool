import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildMeaningfulFileMap,
  meaningfulGitPaths,
} from '@backend/business/codex/helper/build-meaningful-file-map.js';

function write(workspace: string, relativeFile: string, content = ''): void {
  const file = join(workspace, relativeFile);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

test('meaningful file map uses Git ignore rules and renders source plus documentation as a stable tree', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-file-map-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: workspace });
    write(workspace, '.gitignore', ['ignored/', '*.generated.ts', ''].join('\n'));
    write(workspace, 'README.md');
    write(workspace, 'docs/café.md');
    write(workspace, 'docs/guide.md');
    write(workspace, 'src/index.ts');
    write(workspace, 'src/nested/view.tsx');
    write(workspace, 'tests/index.test.ts');
    write(workspace, 'src/deleted.ts');
    execFileSync('git', ['add', '.gitignore', 'src/deleted.ts'], { cwd: workspace });
    rmSync(join(workspace, 'src/deleted.ts'));
    write(workspace, 'ignored/secret.ts');
    write(workspace, 'src/schema.generated.ts');
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
      'docs/café.md',
      'docs/guide.md',
      'src/index.ts',
      'src/nested/view.tsx',
      'tests/index.test.ts',
    ]);
    assert.equal(buildMeaningfulFileMap(workspace), [
      '.',
      '  .gitignore',
      '  README.md',
      '  docs/',
      '    caf\\u00e9.md',
      '    guide.md',
      '  src/',
      '    index.ts',
      '    nested/',
      '      view.tsx',
      '  tests/',
      '    index.test.ts',
    ].join('\n'));
    assert.doesNotMatch(buildMeaningfulFileMap(workspace), /[^\x00-\x7f]/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('meaningful file map stays failsafe outside a Git work tree', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-file-map-no-git-'));
  try {
    assert.equal(
      buildMeaningfulFileMap(workspace),
      '.\n  (file map unavailable: Git could not enumerate this workspace)',
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
