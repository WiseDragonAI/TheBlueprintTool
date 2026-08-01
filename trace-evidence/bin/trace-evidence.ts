#!/usr/bin/env node
/**
 * WHAT: Exposes background trace jobs, task discovery, event views, waiting, and reports.
 * WHY: Agents need one stable executable for the generalized evidence-production procedure.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import type { RawTelemetryEvent, TraceJob, TraceRepositoryAdapter } from '../src/lib/types.js';
import { parseArgv, value, values } from '../src/business/command/helper/parse-argv.js';
import { help } from '../src/business/command/helper/help.js';
import { readJob, writeJob } from '../src/business/job/effect/job-store.js';
import { runTraceJob } from '../src/business/job/controller/run-trace-job.js';
import { DecisionOsAdapter } from '../src/business/adapter/decision-os-adapter.js';
import { ReferenceNodeAdapter } from '../src/business/adapter/reference-node-adapter.js';
import { loadTraceConfig } from '../src/business/config/helper/load-trace-config.js';

function duration(text: string): number {
  const match = text.match(/^(\d+)(ms|s|m)?$/);
  // WHAT: Reject invalid and non-positive deadlines before accepting a job.
  // WHY: Every background and child wait requires a finite deadline.
  if (!match || Number(match[1]) <= 0) throw new Error(`invalid_duration:${text}`);
  return Number(match[1]) * (match[2] === 'm' ? 60_000 : match[2] === 's' ? 1_000 : 1);
}

function jobPath(root: string, jobId: string): string { return join(root, jobId, 'job.json'); }
function emit(value: unknown): void { process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`); }

async function createJob(kind: 'test' | 'task', action: ReturnType<typeof parseArgv>): Promise<TraceJob> {
  const repoRoot = resolve(value(action, 'repo-root', process.cwd()));
  const config = await loadTraceConfig(repoRoot);
  const artifactRoot = resolve(value(action, 'output', join(repoRoot, config.artifacts)));
  const jobId = `trace-${Date.now()}-${randomUUID().slice(0, 12)}`;
  const cardIds = values(action, 'card-id');
  const testFiles = values(action, 'test-file');
  const environment = Object.fromEntries(values(action, 'env').map((entry) => {
    const separator = entry.indexOf('=');
    // WHAT: Reject environment entries without an explicit name and value boundary.
    // WHY: Child configuration must remain structured argv data rather than shell syntax.
    if (separator <= 0) throw new Error(`invalid_environment:${entry}`);
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
  const job: TraceJob = { version: 1, jobId, adapter: 'decision-os', kind, phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), supervisorPid: null, phaseTimestamps: { accepted: new Date().toISOString() }, artifactRoot, scopes: kind === 'test' ? [{ scopeId: testFiles.join(',') || 'selected-tests', kind, testIds: testFiles, cardIds: [], executionIds: [], sessionIds: [], providerSessionIds: [], status: 'pending', error: null }] : cardIds.map((cardId) => ({ scopeId: cardId, projectId: value(action, 'project'), kind, testIds: [], cardIds: [cardId], executionIds: values(action, 'execution-id'), sessionIds: values(action, 'session-id'), providerSessionIds: values(action, 'provider-session-id'), status: 'pending', error: null })), failures: [], parseFailures: [], droppedRecords: [], processes: [], cancellation: { requestedAt: null, origin: null }, artifacts: [], request: { cwd: resolve(value(action, 'cwd', repoRoot)), testFiles, testNames: values(action, 'test-name'), command: action.childCommand, projectId: value(action, 'project'), cardIds, executionIds: values(action, 'execution-id'), sessionIds: values(action, 'session-id'), sourceMaps: values(action, 'source-map').map((path) => resolve(path)), environment, includePresentation: action.flags.has('include-presentation'), includeRawCodex: action.flags.has('include-raw-codex') }, options: { graphify: value(action, 'graphify', 'touched') as TraceJob['options']['graphify'], stacks: value(action, 'stacks', 'both') as TraceJob['options']['stacks'], timeoutMs: duration(value(action, 'timeout', '10m')), graphifyTimeoutMs: duration(value(action, 'graphify-timeout', '10m')), maxArtifactBytes: Number(value(action, 'max-artifact-bytes', '104857600')), redaction: value(action, 'redaction', 'default') } };
  job.adapter = config.adapter;
  // WHAT: Apply the repository Graphify default only when the command omitted an override.
  // WHY: Command arguments take precedence without rewriting repository configuration.
  if (!action.values.has('graphify')) job.options.graphify = config.graphifyDefaultScope;
  job.request.includePresentation = value(action, 'include-presentation', 'true') !== 'false';
  job.request.includeRawCodex = value(action, 'include-raw-codex', 'false') === 'true';
  job.request.runtimeRoot = resolve(value(action, 'runtime-root', repoRoot));
  job.request.executionMode = value(action, 'execution', 'default') as TraceJob['request']['executionMode'];
  job.request.providerSessionIds = values(action, 'provider-session-id');
  job.request.includeSubtasks = value(action, 'include-subtasks', 'false') === 'true';
  job.request.replica = value(action, 'replica', 'workstation');
  job.request.telemetryRoot = resolve(value(action, 'telemetry-root', job.request.runtimeRoot ?? repoRoot));
  // WHAT: Reject unsupported collection modes and invalid resource ceilings before acceptance.
  // WHY: Configuration validation must finish before a background worker can mutate artifacts.
  if (!['off', 'touched', 'all'].includes(job.options.graphify) || !['raw', 'mapped', 'both'].includes(job.options.stacks) || !['default', 'latest', 'active'].includes(job.request.executionMode ?? '') || !Number.isSafeInteger(job.options.maxArtifactBytes) || (job.options.maxArtifactBytes ?? 0) <= 0) throw new Error('invalid_trace_configuration');
  // WHAT: Require direct child argv for test jobs.
  // WHY: Empty test commands cannot acquire the repository lease or produce evidence.
  if (kind === 'test' && job.request.command.length === 0) throw new Error('test_command_required');
  // WHAT: Require explicit cards and project for task jobs.
  // WHY: Broad catalog scans cannot prove exact task scope.
  if (kind === 'task' && (!job.request.projectId || cardIds.length === 0)) throw new Error('task_scope_required');
  await writeJob(job);
  return job;
}

async function launchWorker(job: TraceJob, repoRoot: string): Promise<void> {
  const executable = fileURLToPath(import.meta.url);
  const telemetryFile = join(job.artifactRoot, job.jobId, 'supervisor-telemetry.jsonl');
  const child = spawn(process.execPath, [executable, 'worker', '--job-file', jobPath(job.artifactRoot, job.jobId), '--repo-root', repoRoot], { detached: true, stdio: 'ignore', env: { ...process.env, DECISION_OS_TRACE_RUNTIME_ROOT: job.request.runtimeRoot ?? repoRoot, DECISION_OS_TRACE_TELEMETRY_ROOT: job.request.telemetryRoot ?? job.request.runtimeRoot ?? repoRoot, TRACE_EVIDENCE_JOB_ID: job.jobId, TRACE_EVIDENCE_RUN_ID: job.jobId, TRACE_EVIDENCE_SCOPE_ID: 'trace-worker', TRACE_EVIDENCE_TELEMETRY_FILE: telemetryFile } });
  job.supervisorPid = child.pid ?? null;
  await writeJob(job);
  child.unref();
}

async function waitForJob(file: string, until: string, timeoutMs: number): Promise<TraceJob> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await readJob(file);
    const terminal = ['complete', 'failed', 'cancelled', 'interrupted'].includes(job.phase);
    const evidence = ['evidence_ready', 'mapping_sources', 'running_graphify', 'writing_report'].includes(job.phase) || terminal;
    // WHAT: Return when the requested durable milestone is observed.
    // WHY: Agents may inspect raw evidence before derived stages finish.
    if ((until === 'evidence' && evidence) || (until === 'complete' && terminal)) return job;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`wait_timeout:${file}`);
}

async function repositoryAdapter(repoRoot: string, configured: string, runtimeRoot = repoRoot, telemetryRoot = runtimeRoot): Promise<TraceRepositoryAdapter> {
  // WHAT: Select the built-in Decision OS adapter by its stable configuration name.
  // WHY: Decision OS owns task discovery, execution presentation, and verification lease semantics.
  if (configured === 'decision-os') return new DecisionOsAdapter(repoRoot, process.env.DECISION_OS_SERVER_URL, runtimeRoot, telemetryRoot);
  // WHAT: Select the built-in reference adapter for ordinary Node repositories.
  // WHY: Adapter conformance needs a minimal second-repository implementation.
  if (configured === 'reference-node') return new ReferenceNodeAdapter(repoRoot);
  const module = await import(pathToFileURL(resolve(repoRoot, configured)).href) as { default?: new (root: string) => TraceRepositoryAdapter; Adapter?: new (root: string) => TraceRepositoryAdapter };
  const Constructor = module.default ?? module.Adapter;
  // WHAT: Reject a configured module without an adapter constructor.
  // WHY: Invalid repository configuration must fail before job acceptance.
  if (!Constructor) throw new Error(`invalid_trace_adapter:${configured}`);
  return new Constructor(repoRoot);
}

async function main(): Promise<void> {
  const action = parseArgv(process.argv.slice(2));
  const repoRoot = resolve(value(action, 'repo-root', process.cwd()));
  const config = await loadTraceConfig(repoRoot);
  const artifactRoot = resolve(value(action, 'output', join(repoRoot, config.artifacts)));
  const runtimeRoot = resolve(value(action, 'runtime-root', process.env.DECISION_OS_TRACE_RUNTIME_ROOT ?? repoRoot));
  const adapter = await repositoryAdapter(repoRoot, config.adapter, runtimeRoot, resolve(value(action, 'telemetry-root', process.env.DECISION_OS_TRACE_TELEMETRY_ROOT ?? runtimeRoot)));
  // WHAT: Render the stable agent-facing command contract without creating a job.
  // WHY: Help is observational and must not touch repository runtime state.
  if (action.command === 'help') { emit(help()); return; }
  // WHAT: Persist and detach a test or task evidence job.
  // WHY: Agents need an immediate job identity while collection continues in the background.
  if (action.command === 'start-tests' || action.command === 'start-tasks') {
    const job = await createJob(action.command === 'start-tests' ? 'test' : 'task', action);
    await launchWorker(job, repoRoot); emit({ version: 1, jobId: job.jobId, status: 'accepted', statusFile: jobPath(job.artifactRoot, job.jobId) }); return;
  }
  // WHAT: Run the internal durable worker entrypoint.
  // WHY: Only this branch owns supervisor signal handling and job settlement.
  if (action.command === 'worker') {
    const job = await readJob(resolve(value(action, 'job-file')));
    const controller = new AbortController();
    const cancel = () => { job.cancellation = { requestedAt: new Date().toISOString(), origin: 'agent' }; controller.abort(); };
    process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
    await runTraceJob(job, adapter, controller.signal);
    process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
    return;
  }
  // WHAT: Return identity-only card and session discovery.
  // WHY: Discovery must not expose Codex content or start evidence collection.
  if (action.command === 'cards' || action.command === 'sessions') { emit(await adapter.resolveCards({ projectId: value(action, 'project'), cardIds: values(action, 'card-id'), replica: value(action, 'replica', 'workstation') })); return; }
  const file = jobPath(artifactRoot, value(action, 'job'));
  // WHAT: Return the current validated durable job state.
  // WHY: Status observation must not wait for another transition.
  if (action.command === 'status') { emit(await readJob(file)); return; }
  // WHAT: Wait for the requested durable milestone with a finite deadline.
  // WHY: Agents may begin raw inspection before derived processing settles.
  if (action.command === 'wait') { emit(await waitForJob(file, value(action, 'until', 'complete'), duration(value(action, 'timeout', '10m')))); return; }
  // WHAT: Print the selected Markdown or machine-readable report.
  // WHY: Completed artifacts remain directly consumable without rerunning collection.
  // WHAT: Return the stable machine evidence report for JSON requests.
  // WHY: The manifest contains supervisor timings while replay consumers require deterministic evidence content.
  if (action.command === 'report') { emit(await readFile(join(dirname(file), value(action, 'format', 'markdown') === 'json' ? 'report.json' : 'report.md'), 'utf8')); return; }
  // WHAT: Filter only the displayed normalized event projection.
  // WHY: Query limits and filters must never rewrite or truncate raw telemetry artifacts.
  if (action.command === 'events') {
    const events = ['telemetry.jsonl', 'supervisor-telemetry.jsonl'].flatMap((name) => readFileSync(join(dirname(file), name), 'utf8').split('\n').flatMap((line) => { try { return line ? [JSON.parse(line) as RawTelemetryEvent] : []; } catch { return []; } }));
    const names = new Set(values(action, 'event-name'));
    const statuses = new Set(values(action, 'status'));
    const since = value(action, 'since'); const until = value(action, 'until');
    emit(events.filter((event) => (names.size === 0 || names.has(event.name)) && (statuses.size === 0 || statuses.has(event.phase)) && (!since || event.emittedAt >= since) && (!until || event.emittedAt <= until)).slice(0, Number(value(action, 'limit', '100')))); return;
  }
  // WHAT: Request scoped cancellation through the recorded supervisor process.
  // WHY: The supervisor owns child termination, writer flush, and terminal manifest creation.
  if (action.command === 'cancel') {
    const job = await readJob(file);
    job.cancellation = { requestedAt: new Date().toISOString(), origin: 'agent' };
    await writeJob(job);
    // WHAT: Signal only the recorded non-terminal supervisor process.
    // WHY: Cancellation must propagate through the supervisor so it can flush writers and settle its manifest.
    if (job.supervisorPid && !['complete', 'failed', 'cancelled', 'interrupted'].includes(job.phase)) process.kill(job.supervisorPid, 'SIGTERM');
    emit(job); return;
  }
  throw new Error(`unsupported_command:${action.command}`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
