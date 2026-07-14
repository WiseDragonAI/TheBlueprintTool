import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatus, classifyProcesses, formatStatus, parseMeminfo } from '../../bin/decision-os-workload-status.mjs';

const safeMemory = parseMeminfo(`MemTotal:        7616036 kB
MemAvailable:    2368024 kB
SwapTotal:       4194300 kB
SwapFree:        1713516 kB
`);

test('reports GO with safe memory and no heavy verification', () => {
  const status = buildStatus(safeMemory, [{ pid: 1, rssKib: 10, ageSeconds: 20, argv: ['/usr/bin/codex.bin', 'exec', '-C', '/repo'] }]);
  assert.equal(status.decision, 'GO');
  assert.equal(status.codexCount, 1);
  assert.match(formatStatus(status), /^GO heavy=0 codex=1 mem=2\.3GiB\/7\.3GiB swap=2\.4GiB\/4\.0GiB$/);
});

test('reports WAIT and lists one test-suite parent', () => {
  const processes = [
    { pid: 10, rssKib: 40960, ageSeconds: 70, argv: ['/usr/bin/node', '--test', '--test-concurrency=1', 'test/a.test.ts'] },
    { pid: 11, rssKib: 20480, ageSeconds: 68, argv: ['/usr/bin/node', '--test-child-v8', 'test/a.test.ts'] }
  ];
  const status = buildStatus(safeMemory, processes);
  assert.equal(status.decision, 'WAIT');
  assert.equal(status.heavy.length, 1);
  assert.equal(formatStatus(status).split('\n')[1], 'TEST pid=10 rss=40MiB');
});

test('detects typechecks and pressure independently', () => {
  const processes = classifyProcesses([{ pid: 12, rssKib: 1024, ageSeconds: 2, argv: ['/usr/bin/node', '/repo/node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'] }]);
  assert.equal(processes[0].kind, 'typecheck');
  const status = buildStatus({ ...safeMemory, MemAvailable: 900000, SwapFree: 0 }, []);
  assert.deepEqual(status.reasons, ['low-memory', 'high-swap']);
});
