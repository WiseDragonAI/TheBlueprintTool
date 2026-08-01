#!/usr/bin/env node
/**
 * WHAT: Runs selected test processes under one outer repository verification lease.
 * WHY: The lease must remain owned until every selected process and evidence writer settles.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import { basename, join } from 'node:path';
import type { TestCommand } from '../src/lib/types.js';
import { extractStdoutTelemetry } from '../src/business/evidence/helper/extract-stdout-telemetry.js';

type BatchSpecification = { jobId: string; directory: string; timeoutMs: number; environment: Record<string, string>; commands: TestCommand[] };
const specification = JSON.parse(await readFile(process.argv[2], 'utf8')) as BatchSpecification;
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort());
process.once('SIGINT', () => controller.abort());

async function runSelectedCommand(command: TestCommand): Promise<void> {
  // WHAT: Stop admitting selected tests after outer-lease cancellation.
  // WHY: The current child settles first and later scopes must remain unstarted.
  if (controller.signal.aborted) return;
  const slug = command.testId.replace(/[^a-z0-9_.-]+/gi, '_');
  const stdoutPath = join(specification.directory, `${slug}.stdout.log`);
  const stderrPath = join(specification.directory, `${slug}.stderr.log`);
  const stdout = createWriteStream(stdoutPath, { flags: 'a' });
  const stderr = createWriteStream(stderrPath, { flags: 'a' });
  const startedAt = new Date().toISOString();
  const child = spawn(command.executable, command.args, { cwd: command.cwd, env: { ...process.env, ...specification.environment, ...command.env, TRACE_EVIDENCE_JOB_ID: specification.jobId, TRACE_EVIDENCE_RUN_ID: specification.jobId, TRACE_EVIDENCE_SCOPE_ID: command.testId, TRACE_EVIDENCE_TEST_ID: command.testId, TRACE_EVIDENCE_TELEMETRY_FILE: join(specification.directory, 'telemetry.jsonl'), TRACE_EVIDENCE_FAILURE_FILE: join(specification.directory, 'test-events.jsonl') }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(stdout); child.stderr.pipe(stderr);
  let timedOut = false;
  let escalation: NodeJS.Timeout | null = null;
  const terminate = () => {
    child.kill('SIGTERM');
    escalation = setTimeout(() => {
      // WHAT: Escalate only while the exact selected child remains unsettled.
      // WHY: A test may ignore SIGTERM and the outer verification lease still needs finite settlement.
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2_000);
  };
  const deadline = setTimeout(() => { timedOut = true; terminate(); }, specification.timeoutMs);
  controller.signal.addEventListener('abort', terminate, { once: true });
  const [exitCode, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolveClose, reject) => { child.once('error', reject); child.once('close', (code, closeSignal) => resolveClose([code, closeSignal])); });
  clearTimeout(deadline); controller.signal.removeEventListener('abort', terminate);
  // WHAT: Retire a pending escalation after child settlement.
  // WHY: Late signals must never target a recycled process identity.
  if (escalation) clearTimeout(escalation);
  await Promise.all([finished(stdout), finished(stderr)]);
  const stdoutText = await readFile(stdoutPath, 'utf8');
  const stderrText = await readFile(stderrPath, 'utf8');
  await appendFile(join(specification.directory, 'stdout.log'), stdoutText);
  await appendFile(join(specification.directory, 'stderr.log'), stderrText);
  const telemetry = extractStdoutTelemetry({ text: stdoutText, jobId: specification.jobId, scopeId: command.testId, testId: command.testId });
  // WHAT: Append stdout telemetry only when the harness emitted compatible records.
  // WHY: Normal test output remains byte-identical in stdout.log.
  if (telemetry.length > 0) await appendFile(join(specification.directory, 'telemetry.jsonl'), `${telemetry.map((event) => JSON.stringify(event)).join('\n')}\n`);
  await appendFile(join(specification.directory, 'test-events.jsonl'), `${JSON.stringify({ testId: command.testId, pid: child.pid ?? null, exitCode, signal, timedOut, startedAt, finishedAt: new Date().toISOString(), status: controller.signal.aborted ? 'cancelled' : exitCode === 0 && !timedOut ? 'succeeded' : 'failed' })}\n`);
}

let nextCommand = 0;
const worker = async () => {
  // WHAT: Admit selected commands in caller order up to the repository-wide three-process ceiling.
  // WHY: Concurrent test telemetry may interleave while one outer lease retains bounded ownership.
  while (nextCommand < specification.commands.length) {
    const command = specification.commands[nextCommand]; nextCommand += 1;
    await runSelectedCommand(command);
  }
};
await Promise.all(Array.from({ length: Math.min(3, specification.commands.length) }, worker));

process.stdout.write(`trace batch settled: ${basename(process.argv[2])}\n`);
