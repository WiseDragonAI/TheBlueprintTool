import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatus, classifyProcesses, formatStatus } from '../../bin/decision-os-workload-status.mjs';

const root = '/repo/decision-os';

test('reports GO when Decision OS has no verification process', () => {
  const status = buildStatus([
    { pid: 1, cwd: root, argv: ['/usr/bin/codex.bin', 'exec', '-C', root] },
    { pid: 2, cwd: '/repo/other', argv: ['/usr/bin/node', '--test', 'test/a.test.ts'] }
  ], root);
  assert.equal(formatStatus(status), 'GO tests=0 typechecks=0');
});

test('reports WAIT and lists Decision OS test parent', () => {
  const status = buildStatus([
    { pid: 10, cwd: `${root}/backend`, argv: ['/usr/bin/node', '--test', 'test/a.test.ts'] },
    { pid: 11, cwd: `${root}/backend`, argv: ['/usr/bin/node', '--test-child-v8', 'test/a.test.ts'] }
  ], root);
  assert.equal(status.decision, 'WAIT');
  assert.equal(formatStatus(status), [
    'WAIT tests=1 typechecks=0',
    'TEST pid=10 cwd=backend command=--test test/a.test.ts'
  ].join('\n'));
});

test('detects typechecks in Decision OS worktrees', () => {
  const processes = classifyProcesses([{
    pid: 12,
    cwd: `${root}/.worktrees/feature/backend`,
    argv: ['/usr/bin/node', `${root}/backend/node_modules/typescript/bin/tsc`, '-p', 'tsconfig.json']
  }], root);
  assert.equal(processes[0].kind, 'typecheck');
});
