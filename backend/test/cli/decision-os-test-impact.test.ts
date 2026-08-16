import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyzeCommitImpact,
  buildFileDependencyGraph,
  isTestFile,
  parseNameStatus,
  selectImpactedTests,
} from '../../../bin/decision-os-test-impact.mjs';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

test('name-status parsing preserves rename destinations and test conventions', () => {
  assert.deepEqual(parseNameStatus('M\tsrc/value.ts\nR100\ttest/old.test.ts\ttest/new.test.ts\nD\ttest/gone.spec.ts\n'), [
    { status: 'M', path: 'src/value.ts', oldPath: '' },
    { status: 'R', path: 'test/new.test.ts', oldPath: 'test/old.test.ts' },
    { status: 'D', path: 'test/gone.spec.ts', oldPath: '' },
  ]);
  assert.equal(isTestFile('frontend/test/runtime/value.integration.test.ts'), true);
  assert.equal(isTestFile('src/business/value.ts'), false);
});

test('file graph traversal selects direct changed tests and transitive dependent tests', () => {
  const fileGraph = buildFileDependencyGraph({
    nodes: [
      { id: 'source', source_file: 'src/source.ts' },
      { id: 'service', source_file: 'src/service.ts' },
      { id: 'dependent-test', source_file: 'test/service.test.ts' },
      { id: 'changed-test', source_file: 'test/changed.test.ts' },
      { id: 'external' },
    ],
    edges: [
      { source: 'service', target: 'source', relation: 'imports' },
      { source: 'dependent-test', target: 'service', relation: 'imports' },
      { source: 'source', target: 'source', relation: 'contains' },
      { source: 'dependent-test', target: 'external', relation: 'imports' },
    ],
  });
  assert.deepEqual(selectImpactedTests({
    changedPaths: ['src/source.ts'],
    changedTests: ['test/changed.test.ts'],
    fileGraph,
  }), [
    { file: 'test/changed.test.ts', reason: 'changed', path: ['test/changed.test.ts'] },
    { file: 'test/service.test.ts', reason: 'dependency', path: ['test/service.test.ts', 'src/service.ts', 'src/source.ts'] },
  ]);
});

test('commit analysis combines Git changes with a Graphify file graph', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-test-impact-fixture-'));
  try {
    git(root, ['init', '-b', 'dev']);
    git(root, ['config', 'user.name', 'Test']);
    git(root, ['config', 'user.email', 'test@example.com']);
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'src/value.ts'), 'export const value = 1;\n');
    writeFileSync(join(root, 'test/value.test.ts'), "import { value } from '../src/value.js';\n");
    git(root, ['add', 'src/value.ts', 'test/value.test.ts']);
    git(root, ['commit', '-m', 'Initial fixture']);
    writeFileSync(join(root, 'src/value.ts'), 'export const value = 2;\n');
    git(root, ['add', 'src/value.ts']);
    git(root, ['commit', '-m', 'Change value']);
    const changedCommit = git(root, ['rev-parse', 'HEAD']);
    const graphPath = join(root, 'graph.json');
    writeFileSync(graphPath, JSON.stringify({
      nodes: [
        { id: 'source', source_file: 'src/value.ts' },
        { id: 'test', source_file: 'test/value.test.ts' },
      ],
      edges: [{ source: 'test', target: 'source', relation: 'imports' }],
    }));
    const report = analyzeCommitImpact({ repository: root, commitInputs: [changedCommit], graphPath });
    assert.deepEqual(report.changedCodeFiles, ['src/value.ts']);
    assert.deepEqual(report.affectedTests, ['test/value.test.ts']);
    assert.deepEqual(report.selectedTests[0].path, ['test/value.test.ts', 'src/value.ts']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
