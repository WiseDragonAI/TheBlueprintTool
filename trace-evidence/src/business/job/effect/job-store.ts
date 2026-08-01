/**
 * WHAT: Persists and reads one durable trace job through atomic JSON replacement.
 * WHY: Background clients and recovery need a validated state file that is never partially written.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TraceJob } from '../../../lib/types.js';

export function jobFile(job: Pick<TraceJob, 'artifactRoot' | 'jobId'>): string { return join(job.artifactRoot, job.jobId, 'job.json'); }

export async function writeJob(job: TraceJob): Promise<void> {
  const file = jobFile(job);
  const temporary = `${file}.${process.pid}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export async function readJob(file: string): Promise<TraceJob> {
  const bytes = await readFile(file, 'utf8');
  try {
    const parsed = JSON.parse(bytes) as TraceJob;
    // WHAT: Reject unsupported durable job records before a controller uses their paths.
    // WHY: Invalid state must remain untouched and cannot be treated as an empty job.
    if (parsed.version !== 1 || !parsed.jobId || !parsed.artifactRoot || !parsed.phase) throw new Error('required job identity is missing');
    return parsed;
  } catch (error) {
    const incident = { version: 1, scope: 'trace-job', component: 'job-store', operation: 'read', code: 'invalid_trace_job', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack ?? '' : '', path: file, firstObservedAt: new Date().toISOString(), lastObservedAt: new Date().toISOString(), occurrenceCount: 1 };
    try { await writeFile(`${file}.incident.json`, `${JSON.stringify(incident, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); } catch { /* Existing incident evidence or diagnostic failure remains contained. */ }
    throw new Error(`invalid_trace_job:${file}`);
  }
}
