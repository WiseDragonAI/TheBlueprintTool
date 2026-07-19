import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { archiveTaskStateArtifacts } from '../../../src/business/task-state/helper/task-state-git-archive.js';

test('immutable artifacts archive on independent writer refs without changing the shared branch', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-archive-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Decision OS Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@decision-os.local']);
  writeFileSync(resolve(root, 'code.txt'), 'code');
  execFileSync('git', ['-C', root, 'add', 'code.txt']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'code']);
  const branchBefore = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync(resolve(root, 'artifacts'));
  const segment = resolve(root, 'artifacts', 'segment-a.jsonl');
  writeFileSync(segment, '{"eventId":"a"}\n');
  const left = archiveTaskStateArtifacts({ repositoryRoot: root, writerId: 'node-a', projectId: 'project-a', files: [segment] });
  const right = archiveTaskStateArtifacts({ repositoryRoot: root, writerId: 'node-b', projectId: 'project-a', files: [segment] });
  assert.notEqual(left.ref, right.ref);
  assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), branchBefore);
  assert.equal(execFileSync('git', ['-C', root, 'status', '--short'], { encoding: 'utf8' }).includes('code.txt'), false);
});

