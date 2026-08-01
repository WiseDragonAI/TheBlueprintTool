import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readJob } from '../../src/business/job/effect/job-store.js';

test('invalid durable job bytes remain unchanged and produce readable incident evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-corrupt-job-')); const file = join(root, 'job.json'); const bytes = '{invalid'; await writeFile(file, bytes);
  await assert.rejects(readJob(file), /invalid_trace_job/);
  assert.equal(await readFile(file, 'utf8'), bytes);
  assert.match(await readFile(`${file}.incident.json`, 'utf8'), /invalid_trace_job/);
});
