/**
 * WHAT: Supervises one persisted trace job from raw collection through derived report artifacts.
 * WHY: Background execution needs one controller that contains failures by stage and never rewrites test outcomes.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { ArtifactDescriptor, RawTelemetryEvent, TraceJob, TraceRepositoryAdapter } from '../../../lib/types.js';
import { writeJob } from '../effect/job-store.js';
import { openArtifact, finalizeArtifact } from '../../evidence/effect/artifact-writer.js';
import { writeDerivedArtifact } from '../../evidence/effect/write-derived-artifact.js';
import { runTestProcess } from '../../test/effect/run-test-process.js';
import { mapTelemetryStacks, type MappedEventStack } from '../../stack/helper/map-telemetry-stacks.js';
import { runGraphify, type GraphifyRun } from '../../graph/effect/run-graphify.js';
import { renderReport } from '../../report/helper/render-report.js';
import { telemetry } from '../../../lib/telemetry.js';
import { extractStdoutTelemetry } from '../../evidence/helper/extract-stdout-telemetry.js';
import { parseTelemetryJsonl } from '../../evidence/helper/parse-telemetry-jsonl.js';
import { correlateEvidence } from '../../correlation/helper/correlate-evidence.js';

const rawArtifactKinds = {
  'stdout.log': 'text/plain',
  'stderr.log': 'text/plain',
  'test-events.jsonl': 'application/x-ndjson',
  'telemetry.jsonl': 'application/x-ndjson',
  'supervisor-telemetry.jsonl': 'application/x-ndjson',
  'task-events.jsonl': 'application/x-ndjson',
  'raw-codex.jsonl': 'application/x-ndjson',
  'presentation.jsonl': 'application/x-ndjson',
} as const;
type AnyTestResult = { testId: string; pid: number | null; exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean; startedAt: string; finishedAt: string; status: TraceJob['scopes'][number]['status'] };

async function transition(job: TraceJob, phase: TraceJob['phase']): Promise<void> {
  job.phase = phase;
  job.updatedAt = new Date().toISOString();
  (job.phaseTimestamps ??= {})[phase] = job.updatedAt;
  await writeJob(job);
}

function failure(job: TraceJob, component: string, operation: string, error: unknown): void {
  job.failures.push({ component, operation, code: error instanceof Error && error.message.split(':')[0] || 'trace_failure', message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() });
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    // WHAT: Traverse derived output directories and admit files only.
    // WHY: The manifest hashes files while directories carry no stable byte identity.
    if (entry.isDirectory()) files.push(...await listFiles(path)); else files.push(path);
  }
  return files;
}

async function initializeRawArtifacts(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const name of Object.keys(rawArtifactKinds)) await writeFile(join(directory, name), '', { encoding: 'utf8', flag: 'a' });
}

async function finalizeRawArtifacts(job: TraceJob, directory: string): Promise<void> {
  const scopeIds = job.scopes.map((scope) => scope.scopeId);
  for (const [name, mediaType] of Object.entries(rawArtifactKinds)) {
    const path = join(directory, name);
    const body = await readFile(path);
    const ceiling = job.options.maxArtifactBytes ?? 104_857_600;
    // WHAT: Retain only the configured prefix when a raw artifact exceeds its resource ceiling.
    // WHY: Bounded evidence must expose the exact first dropped byte and cannot claim completeness.
    if (body.byteLength > ceiling) {
      await writeFile(path, body.subarray(0, ceiling));
      (job.droppedRecords ??= []).push({ artifact: path, firstDroppedByte: ceiling, reason: 'max_artifact_bytes' });
    }
    const descriptor = await finalizeArtifact(path, 'evidence-collector', mediaType, scopeIds);
    descriptor.complete = !(job.droppedRecords ?? []).some((entry) => entry.artifact === path);
    job.artifacts.push(descriptor);
  }
}

async function sourceFileDetails(files: string[], adapter: TraceRepositoryAdapter) { return adapter.resolveSourceFiles({ files }); }

async function installManifest(job: TraceJob, directory: string, phase: TraceJob['phase'], graphify: GraphifyRun | null): Promise<void> {
  const manifestPath = join(directory, 'manifest.json');
  const manifest = {
    version: 1,
    jobId: job.jobId,
    phase,
    complete: phase === 'complete' && (job.droppedRecords?.length ?? 0) === 0,
    redactionProfile: job.options.redaction ?? 'default',
    excludedFieldClasses: ['credentials', 'prompts', 'authored-markdown', 'transcripts', 'tokens', 'unrestricted-output'],
    artifacts: job.artifacts,
    failures: job.failures,
    parseFailures: job.parseFailures,
    droppedRecords: job.droppedRecords,
    processes: job.processes,
    cancellation: job.cancellation,
    graphify,
  };
  await writeDerivedArtifact(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  job.artifacts = job.artifacts.filter((artifact) => artifact.path !== manifestPath);
  job.artifacts.push(await finalizeArtifact(manifestPath, 'job-supervisor', 'application/json', job.scopes.map((scope) => scope.scopeId)));
}

async function collectTests(job: TraceJob, adapter: TraceRepositoryAdapter, directory: string, signal?: AbortSignal): Promise<unknown[]> {
  await transition(job, 'waiting_for_lease');
  const commands = await adapter.discoverTests({ files: job.request.testFiles, names: job.request.testNames, command: job.request.command, cwd: job.request.cwd });
  job.scopes = commands.map((command) => ({ scopeId: command.testId, kind: 'test', testIds: [command.testId], cardIds: [], executionIds: [], sessionIds: [], providerSessionIds: [], status: 'pending', error: null }));
  await transition(job, 'running_tests');
  const testResults: unknown[] = [];
  // WHAT: Run adapter-supported batches beneath one outer verification lease.
  // WHY: Decision OS requires the same lease to remain held until every selected process and evidence writer settles.
  if (adapter.wrapTestBatchWithLease) {
    const specificationFile = join(directory, 'test-batch.json');
    await writeDerivedArtifact(specificationFile, `${JSON.stringify({ jobId: job.jobId, directory, timeoutMs: job.options.timeoutMs, environment: job.request.environment ?? {}, commands }, null, 2)}\n`);
    const batchWorker = fileURLToPath(new URL('../../../../bin/run-test-batch.js', import.meta.url));
    const admitted = await adapter.wrapTestBatchWithLease({ jobId: job.jobId, commands, batchWorker, specificationFile });
    const supervisorOut = await openArtifact(join(directory, 'batch-supervisor.stdout.log'));
    const supervisorErr = await openArtifact(join(directory, 'batch-supervisor.stderr.log'));
    const result = await runTestProcess({ command: admitted, stdout: supervisorOut, stderr: supervisorErr, timeoutMs: Math.max(job.options.timeoutMs, job.options.timeoutMs * commands.length), signal });
    supervisorOut.end(); supervisorErr.end(); await Promise.all([finished(supervisorOut), finished(supervisorErr)]);
    job.artifacts.push(await finalizeArtifact(join(directory, 'batch-supervisor.stdout.log'), 'lease-controller', 'text/plain', job.scopes.map((scope) => scope.scopeId)), await finalizeArtifact(join(directory, 'batch-supervisor.stderr.log'), 'lease-controller', 'text/plain', job.scopes.map((scope) => scope.scopeId)));
    const batchRecords = (await readFile(join(directory, 'test-events.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as AnyTestResult & { type?: string; message?: string });
    const records = batchRecords.filter((record) => Boolean(record.testId && record.status));
    for (const record of batchRecords.filter((candidate) => candidate.type === 'collection-failure')) failure(job, 'test-batch', 'telemetry-collection', new Error(record.message ?? 'collection_failure'));
    for (const record of records) {
      testResults.push(record);
      const scope = job.scopes.find((candidate) => candidate.scopeId === record.testId);
      // WHAT: Install each batch result only on its exact selected scope.
      // WHY: Interleaved test settlement cannot collapse identity or overwrite another test result.
      if (scope) scope.status = record.status;
      (job.processes ??= []).push({ scopeId: record.testId, pid: record.pid, startedAt: record.startedAt, finishedAt: record.finishedAt, exitCode: record.exitCode, signal: record.signal, deadlineAt: new Date(Date.parse(record.startedAt) + job.options.timeoutMs).toISOString(), cancellationOrigin: record.status === 'cancelled' ? job.cancellation?.origin ?? 'signal' : null, settled: true });
      const slug = record.testId.replace(/[^a-z0-9_.-]+/gi, '_');
      job.artifacts.push(await finalizeArtifact(join(directory, `${slug}.stdout.log`), 'test-process', 'text/plain', [record.testId]), await finalizeArtifact(join(directory, `${slug}.stderr.log`), 'test-process', 'text/plain', [record.testId]));
    }
    // WHAT: Mark selected tests not admitted before cancellation as cancelled.
    // WHY: Batch status must remain complete even when the lease worker stops between scopes.
    if (signal?.aborted) for (const scope of job.scopes.filter((candidate) => candidate.status === 'pending')) scope.status = 'cancelled';
    void result;
    return testResults;
  }
  for (const command of commands) {
    // WHAT: Stop admitting new test scopes after cancellation.
    // WHY: Cancellation preserves completed evidence and must not launch additional work.
    if (signal?.aborted) break;
    const scope = job.scopes.find((candidate) => candidate.scopeId === command.testId);
    // WHAT: Mark the exact selected test scope as running before process admission.
    // WHY: Batch status must distinguish each independently settled test.
    if (scope) scope.status = 'running';
    const admitted = await adapter.wrapTestCommandWithLease({ jobId: job.jobId, command });
    const slug = command.testId.replace(/[^a-z0-9_.-]+/gi, '_');
    const stdoutPath = join(directory, `${slug}.stdout.log`);
    const stderrPath = join(directory, `${slug}.stderr.log`);
    const stdout = await openArtifact(stdoutPath);
    const stderr = await openArtifact(stderrPath);
    const deadlineAt = new Date(Date.now() + job.options.timeoutMs).toISOString();
    const processRecord = { scopeId: command.testId, pid: null, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, signal: null, deadlineAt, cancellationOrigin: null, settled: false } satisfies NonNullable<TraceJob['processes']>[number];
    (job.processes ??= []).push(processRecord);
    const result = await runTestProcess({ command: { ...admitted, env: { ...admitted.env, ...job.request.environment, TRACE_EVIDENCE_JOB_ID: job.jobId, TRACE_EVIDENCE_RUN_ID: job.jobId, TRACE_EVIDENCE_SCOPE_ID: command.testId, TRACE_EVIDENCE_TEST_ID: command.testId, TRACE_EVIDENCE_TELEMETRY_FILE: join(directory, 'telemetry.jsonl'), TRACE_EVIDENCE_FAILURE_FILE: join(directory, 'test-events.jsonl') } }, stdout, stderr, timeoutMs: job.options.timeoutMs, signal });
    stdout.end(); stderr.end(); await Promise.all([finished(stdout), finished(stderr)]);
    Object.assign(processRecord, { pid: result.pid, finishedAt: result.finishedAt, exitCode: result.exitCode, signal: result.signal, cancellationOrigin: signal?.aborted ? job.cancellation?.origin ?? 'signal' : null, settled: true });
    const stdoutText = await readFile(stdoutPath, 'utf8');
    const stderrText = await readFile(stderrPath, 'utf8');
    await writeFile(join(directory, 'stdout.log'), stdoutText, { encoding: 'utf8', flag: 'a' });
    await writeFile(join(directory, 'stderr.log'), stderrText, { encoding: 'utf8', flag: 'a' });
    job.artifacts.push(await finalizeArtifact(stdoutPath, 'test-process', 'text/plain', [command.testId]), await finalizeArtifact(stderrPath, 'test-process', 'text/plain', [command.testId]));
    const stdoutEvents = extractStdoutTelemetry({ text: stdoutText, jobId: job.jobId, scopeId: command.testId, testId: command.testId });
    // WHAT: Append browser-compatible telemetry envelopes to the canonical telemetry artifact.
    // WHY: Generated harnesses expose raw stacks through stdout instead of direct filesystem writes.
    if (stdoutEvents.length > 0) await writeFile(join(directory, 'telemetry.jsonl'), `${stdoutEvents.map((event) => JSON.stringify(event)).join('\n')}\n`, { encoding: 'utf8', flag: 'a' });
    const status: TraceJob['scopes'][number]['status'] = signal?.aborted ? 'cancelled' : result.exitCode === 0 && !result.timedOut ? 'succeeded' : 'failed';
    const testResult = { testId: command.testId, ...result, status };
    await writeFile(join(directory, 'test-events.jsonl'), `${JSON.stringify(testResult)}\n`, { encoding: 'utf8', flag: 'a' });
    testResults.push(testResult);
    // WHAT: Derive scope status only from the recorded child-process result.
    // WHY: Graphify and evidence failures cannot rewrite test outcomes.
    if (scope) scope.status = testResult.status;
  }
  return testResults;
}

async function collectTasks(job: TraceJob, adapter: TraceRepositoryAdapter, directory: string, signal?: AbortSignal): Promise<void> {
  await transition(job, 'collecting_evidence');
  const selectedCards = await adapter.resolveCards({ projectId: job.request.projectId, cardIds: job.request.cardIds, replica: job.request.replica, signal });
  const resolvedCardIds = job.request.includeSubtasks ? [...new Set(selectedCards.flatMap((card) => [card.cardId, ...card.subtaskIds]))] : job.request.cardIds;
  const cards = resolvedCardIds.length === job.request.cardIds.length ? selectedCards : await adapter.resolveCards({ projectId: job.request.projectId, cardIds: resolvedCardIds, replica: job.request.replica, signal });
  await writeFile(join(directory, 'task-events.jsonl'), `${cards.map((card) => JSON.stringify({ type: 'card-discovery', card })).join('\n')}\n`, { encoding: 'utf8', flag: 'a' });
  const scopes = await adapter.resolveScopes({ projectId: job.request.projectId, cardIds: resolvedCardIds, executionIds: job.request.executionIds, sessionIds: job.request.sessionIds, providerSessionIds: job.request.providerSessionIds, executionMode: job.request.executionMode, replica: job.request.replica, includeRawCodex: job.request.includeRawCodex, includePresentation: job.request.includePresentation, signal });
  job.scopes = scopes;
  const evidenceOffsets = new Map<string, { byteOffset: number; bytes: number }>();
  for (const scope of scopes) {
    // WHAT: Preserve adapter-resolved scope failures without invoking a collector.
    // WHY: One invalid card selector must not discard evidence from valid selected cards.
    if (scope.status === 'failed') { failure(job, 'repository-adapter', `resolve:${scope.scopeId}`, new Error(scope.error ?? 'scope_resolution_failed')); continue; }
    // WHAT: Stop collecting new task scopes after cancellation.
    // WHY: Already appended raw records remain valid while new reads are no longer authorized.
    if (signal?.aborted) break;
    scope.status = 'running';
    try {
      for await (const record of adapter.collectEvidence(scope, signal)) {
        // WHAT: Stop the active collector when cancellation becomes observable.
        // WHY: A bounded task job must propagate cancellation to downstream evidence reads.
        if (signal?.aborted) break;
        const destinationName = record.source === 'stdout' || record.source === 'stderr' ? `${record.source}.log` : `${record.source}.jsonl`;
        const destination = join(directory, destinationName);
        const identity = `${destinationName}\0${record.executionId ?? ''}\0${record.sessionId ?? ''}\0${createHash('sha256').update(record.bytes).digest('hex')}`;
        const existing = evidenceOffsets.get(identity);
        const offset = existing?.byteOffset ?? Buffer.byteLength(await readFile(destination));
        // WHAT: Append one exact raw record only on its first selected-scope occurrence.
        // WHY: Overlapping card sessions require deduplicated bytes with separate scope inventories.
        if (!existing) {
          await writeFile(destination, record.bytes.endsWith('\n') ? record.bytes : `${record.bytes}\n`, { encoding: 'utf8', flag: 'a' });
          evidenceOffsets.set(identity, { byteOffset: offset, bytes: Buffer.byteLength(record.bytes) });
        }
        await writeFile(join(directory, 'task-events.jsonl'), `${JSON.stringify({ source: record.source, scopeId: record.scopeId, cardId: record.cardId, executionId: record.executionId, sessionId: record.sessionId, byteOffset: offset, bytes: existing?.bytes ?? Buffer.byteLength(record.bytes), deduplicated: Boolean(existing) })}\n`, { encoding: 'utf8', flag: 'a' });
      }
      scope.status = signal?.aborted ? 'cancelled' : 'succeeded';
    } catch (error) {
      scope.status = 'failed'; scope.error = error instanceof Error ? error.message : String(error); failure(job, 'repository-adapter', `collect:${scope.scopeId}`, error);
    }
  }
}

async function deriveEvidence(job: TraceJob, adapter: TraceRepositoryAdapter, directory: string, testResults: unknown[], events: RawTelemetryEvent[], signal?: AbortSignal): Promise<{ stacks: MappedEventStack[]; graphify: GraphifyRun; implicatedFiles: string[] }> {
  await transition(job, 'mapping_sources');
  const generatedFiles = [...new Set(events.flatMap((event) => event.rawStack.split('\n').flatMap((line) => {
    const match = line.match(/(?:\(|\s)(file:\/\/[^:()]+|\/[^:()]+):(\d+):(\d+)\)?$/);
    return match ? [match[1].startsWith('file://') ? new URL(match[1]).pathname : match[1]] : [];
  })))];
  const mapPaths = job.request.sourceMaps.length ? job.request.sourceMaps : await adapter.locateSourceMaps({ scopes: job.scopes, generatedFiles, signal });
  for (const mapPath of mapPaths) job.artifacts.push(await finalizeArtifact(mapPath, 'repository-adapter', 'application/json', job.scopes.map((scope) => scope.scopeId)));
  const stacks = await mapTelemetryStacks(events, mapPaths, signal);
  const stacksPath = join(directory, 'stacks.jsonl');
  await writeDerivedArtifact(stacksPath, stacks.map((stack) => JSON.stringify(stack)).join('\n') + (stacks.length ? '\n' : ''));
  job.artifacts.push(await finalizeArtifact(stacksPath, 'source-mapper', 'application/x-ndjson', job.scopes.map((scope) => scope.scopeId)));
  const implicatedFiles = [...new Set(stacks.flatMap((stack) => stack.frames.map((frame) => frame.originalFile).filter((file): file is string => Boolean(file))))];
  const fileDetails = await sourceFileDetails(implicatedFiles, adapter);
  const sourceFilesPath = join(directory, 'source-files.json');
  await writeDerivedArtifact(sourceFilesPath, `${JSON.stringify(fileDetails, null, 2)}\n`);
  job.artifacts.push(await finalizeArtifact(sourceFilesPath, 'source-mapper', 'application/json', job.scopes.map((scope) => scope.scopeId)));
  const flow = correlateEvidence(events);
  const flowPath = join(directory, 'flow.json');
  await writeDerivedArtifact(flowPath, `${JSON.stringify(flow, null, 2)}\n`);
  job.artifacts.push(await finalizeArtifact(flowPath, 'correlator', 'application/json', job.scopes.map((scope) => scope.scopeId)));
  await transition(job, 'running_graphify');
  const graphify = await runGraphify(job, events, implicatedFiles, signal);
  for (const path of await listFiles(graphify.inputDirectory)) job.artifacts.push(await finalizeArtifact(path, 'graphify-input', path.endsWith('.md') ? 'text/markdown' : 'application/json', job.scopes.map((scope) => scope.scopeId)));
  for (const path of await listFiles(graphify.outputDirectory)) job.artifacts.push(await finalizeArtifact(path, 'graphify', path.endsWith('.html') ? 'text/html' : path.endsWith('.md') ? 'text/markdown' : 'application/json', job.scopes.map((scope) => scope.scopeId)));
  // WHAT: Preserve derived Graphify failure without changing recorded test outcomes.
  // WHY: Graph enrichment is diagnostically useful but not test-result authority.
  if (['failed', 'unavailable', 'timed_out'].includes(graphify.status)) failure(job, 'graphify', 'extract', new Error(graphify.stderr || graphify.status));
  await transition(job, 'writing_report');
  const machineReportPath = join(directory, 'report.json');
  const rawArtifacts = job.artifacts.filter((artifact) => Object.keys(rawArtifactKinds).some((name) => artifact.path.endsWith(name))).map(({ path, sha256, bytes, complete, scopeIds }) => ({ path, sha256, bytes, complete, scopeIds }));
  await writeDerivedArtifact(machineReportPath, `${JSON.stringify({ version: 1, jobId: job.jobId, kind: job.kind, selectors: job.request, scopes: job.scopes, tests: testResults, telemetry: events, stacks, flow, sourceFiles: fileDetails, rawArtifacts, completeness: { parseFailures: job.parseFailures, droppedRecords: job.droppedRecords } }, null, 2)}\n`);
  job.artifacts = job.artifacts.filter((artifact) => artifact.path !== machineReportPath);
  job.artifacts.push(await finalizeArtifact(machineReportPath, 'report-renderer', 'application/json', job.scopes.map((scope) => scope.scopeId)));
  const reportPath = join(directory, 'report.md');
  await writeDerivedArtifact(reportPath, renderReport({ job: { ...job, phase: signal?.aborted ? 'cancelled' : 'complete' }, tests: testResults, telemetry: events, stacks, graphify, flow, logs: { stdout: await readFile(join(directory, 'stdout.log'), 'utf8'), stderr: await readFile(join(directory, 'stderr.log'), 'utf8') }, taskEvidence: { inventory: await readFile(join(directory, 'task-events.jsonl'), 'utf8'), presentation: await readFile(join(directory, 'presentation.jsonl'), 'utf8') }, sourceFiles: fileDetails }));
  job.artifacts.push(await finalizeArtifact(reportPath, 'report-renderer', 'text/markdown', job.scopes.map((scope) => scope.scopeId)));
  return { stacks, graphify, implicatedFiles };
}

export async function runTraceJob(job: TraceJob, adapter: TraceRepositoryAdapter, signal?: AbortSignal): Promise<void> {
  const directory = join(job.artifactRoot, job.jobId);
  const testResults: unknown[] = [];
  const admittedPhase = job.phase;
  job.parseFailures ??= []; job.droppedRecords ??= []; job.processes ??= []; job.cancellation ??= { requestedAt: null, origin: null };
  await initializeRawArtifacts(directory);
  job.supervisorPid = process.pid;
  // WHAT: Refuse to rerun an interrupted pre-evidence observation.
  // WHY: Re-executing tests would replace the evidence instead of recovering it.
  if (admittedPhase !== 'accepted' && !job.phaseTimestamps?.evidence_ready) {
    failure(job, 'job', 'recover', new Error(`interrupted_before_evidence:${admittedPhase}`));
    await finalizeRawArtifacts(job, directory);
    await installManifest(job, directory, job.cancellation.requestedAt ? 'cancelled' : 'interrupted', null);
    await transition(job, job.cancellation.requestedAt ? 'cancelled' : 'interrupted');
    return;
  }
  await transition(job, 'resolving_scope');
  let graphify: GraphifyRun | null = null;
  try {
    // WHAT: Resume derived processing only from finalized evidence.
    // WHY: Restarting selected tests would change the observation under investigation.
    if (job.phaseTimestamps?.evidence_ready) {
      const retainedTestEvents = await readFile(join(directory, 'test-events.jsonl'), 'utf8');
      for (const line of retainedTestEvents.split('\n')) {
        // WHAT: Restore only complete retained test result records during derived recovery.
        // WHY: Recovery may render again but must never rerun the observed tests.
        if (line) testResults.push(JSON.parse(line));
      }
      const selected = parseTelemetryJsonl({ artifact: join(directory, 'telemetry.jsonl'), text: await readFile(join(directory, 'telemetry.jsonl'), 'utf8') });
      const supervisor = parseTelemetryJsonl({ artifact: join(directory, 'supervisor-telemetry.jsonl'), text: await readFile(join(directory, 'supervisor-telemetry.jsonl'), 'utf8') });
      job.parseFailures.push(...selected.failures, ...supervisor.failures);
      graphify = (await deriveEvidence(job, adapter, directory, testResults, [...selected.events, ...supervisor.events], signal)).graphify;
    } else {
      // WHAT: Route test and task jobs through their independent collectors.
      // WHY: Task discovery must never acquire the repository verification lease.
      if (job.kind === 'test') testResults.push(...await collectTests(job, adapter, directory, signal)); else await collectTasks(job, adapter, directory, signal);
      await transition(job, 'flushing_evidence');
      telemetry('trace-job-evidence-ready', { jobId: job.jobId });
      const selected = parseTelemetryJsonl({ artifact: join(directory, 'telemetry.jsonl'), text: await readFile(join(directory, 'telemetry.jsonl'), 'utf8') });
      const supervisor = parseTelemetryJsonl({ artifact: join(directory, 'supervisor-telemetry.jsonl'), text: await readFile(join(directory, 'supervisor-telemetry.jsonl'), 'utf8') });
      job.parseFailures.push(...selected.failures, ...supervisor.failures);
      await finalizeRawArtifacts(job, directory);
      await transition(job, 'evidence_ready');
      // WHAT: Skip derived work after cancellation while retaining a readable terminal manifest.
      // WHY: Cancellation must settle promptly after raw writers flush.
      if (!signal?.aborted) graphify = (await deriveEvidence(job, adapter, directory, testResults, [...selected.events, ...supervisor.events], signal)).graphify;
    }
    const scopesPath = join(directory, 'scopes.json');
    await writeDerivedArtifact(scopesPath, `${JSON.stringify(job.scopes, null, 2)}\n`);
    job.artifacts.push(await finalizeArtifact(scopesPath, 'job-supervisor', 'application/json', job.scopes.map((scope) => scope.scopeId)));
    const terminal = signal?.aborted ? 'cancelled' : 'complete';
    await installManifest(job, directory, terminal, graphify);
    await transition(job, terminal);
  } catch (error) {
    failure(job, 'job', 'supervise', error);
    const terminal = signal?.aborted ? 'cancelled' : 'failed';
    await installManifest(job, directory, terminal, graphify).catch((manifestError) => failure(job, 'manifest', 'install', manifestError));
    await transition(job, terminal);
  }
}
