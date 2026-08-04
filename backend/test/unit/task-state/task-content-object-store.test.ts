/**
 * WHAT: Proves task-content capture publishes one stable immutable file version.
 * WHY: Filesystem observation cannot advance a causal head from bytes torn across editor writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createTaskContentObjectStore } from '@backend/business/task-state/helper/task-content-object-store.js';

test('retries an in-place write and commits only the next stable file version', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-stable-content-capture-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const key = '.decision-os/threads/tasks/thread-card-a.md';
  const source = join(workspace, key);
  const stableBody = 'second-version-stable\n';
  mkdirSync(dirname(source), { recursive: true });
  writeFileSync(source, 'first-version-that-will-change\n');
  let changed = false;
  const attempts: number[] = [];
  const store = createTaskContentObjectStore({
    decisionOsRoot,
    projectId: 'project-a',
    captureChunkBytes: 4,
    onCaptureProgress: ({ attempt }) => {
      attempts.push(attempt);
      // WHAT: Change the opened inode during the first capture attempt only.
      // WHY: The regression must deterministically exercise descriptor stability retry.
      if (attempt === 1 && !changed) {
        changed = true;
        writeFileSync(source, stableBody);
      }
    },
  });
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

  const head = await store.capture(key);

  assert.ok(head);
  assert.equal(head.hash, createHash('sha256').update(stableBody).digest('hex'));
  assert.equal(head.bytes, Buffer.byteLength(stableBody));
  assert.equal(readFileSync(store.objectFile(head.hash), 'utf8'), stableBody);
  assert.equal(attempts.includes(2), true);
});

test('captures an atomic editor rename as the complete replacement version', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-atomic-content-capture-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const key = '.decision-os/cards/tasks/card-a.md';
  const source = join(workspace, key);
  const temporary = `${source}.editor`;
  const body = 'Atomic replacement.\n';
  mkdirSync(dirname(source), { recursive: true });
  writeFileSync(source, 'Old.\n');
  writeFileSync(temporary, body);
  renameSync(temporary, source);
  const store = createTaskContentObjectStore({ decisionOsRoot, projectId: 'project-a' });
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

  const head = await store.capture(key);

  assert.ok(head);
  assert.equal(readFileSync(store.objectFile(head.hash), 'utf8'), body);
});
