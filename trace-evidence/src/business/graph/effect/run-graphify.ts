/**
 * WHAT: Runs pinned Graphify against a sanitized trace corpus and records derived outputs.
 * WHY: Static file relationships enrich the evidence while remaining independent of test results.
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { dirname, join, relative, resolve } from 'node:path';
import type { RawTelemetryEvent, TraceJob } from '../../../lib/types.js';

export type GraphifyRun = { status: 'disabled' | 'succeeded' | 'failed' | 'unavailable' | 'timed_out' | 'cancelled'; package: 'graphifyy'; version: '0.9.22'; license: 'MIT'; argv: string[]; postProcessArgv: string[]; environmentPolicy: 'allowlist'; startedAt: string | null; finishedAt: string | null; durationMs: number | null; exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; inputDirectory: string; outputDirectory: string };

export async function runGraphify(job: TraceJob, events: RawTelemetryEvent[], implicatedFiles: string[], signal?: AbortSignal): Promise<GraphifyRun> {
  const outputDirectory = join(job.artifactRoot, job.jobId, 'graphify-out');
  const inputDirectory = join(job.artifactRoot, job.jobId, 'graphify-input');
  const base = { package: 'graphifyy' as const, version: '0.9.22' as const, license: 'MIT' as const, environmentPolicy: 'allowlist' as const, inputDirectory, outputDirectory };
  const graphifyEnvironment = Object.fromEntries(['PATH', 'HOME', 'XDG_CACHE_HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NO_COLOR'].flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name] as string]]));
  // WHAT: Preserve an explicit disabled result without starting an external process.
  // WHY: Graph enrichment is optional while raw evidence remains mandatory.
  if (job.options.graphify === 'off') return { ...base, status: 'disabled', argv: [], postProcessArgv: [], startedAt: null, finishedAt: null, durationMs: null, exitCode: null, signal: null, stdout: '', stderr: '' };
  await mkdir(inputDirectory, { recursive: true });
  const safeEvents = events.map(({ args: _args, rawStack: _rawStack, ...event }) => event);
  await writeFile(join(inputDirectory, 'trace.json'), `${JSON.stringify(safeEvents, null, 2)}\n`, 'utf8');
  const sourceDirectory = join(inputDirectory, 'files');
  await mkdir(sourceDirectory, { recursive: true });
  const copiedFiles: string[] = [];
  for (const file of implicatedFiles) {
    const repositoryRelative = relative(job.request.cwd, file);
    // WHAT: Copy only implicated files contained by the selected repository root.
    // WHY: Graphify input cannot escape into credentials or unrelated authored content.
    if (repositoryRelative.startsWith('..') || resolve(job.request.cwd, repositoryRelative) !== resolve(file)) continue;
    const destination = join(sourceDirectory, repositoryRelative);
    await mkdir(dirname(destination), { recursive: true });
    await cp(file, destination);
    copiedFiles.push(repositoryRelative);
  }
  await writeFile(join(inputDirectory, 'trace.md'), `# Trace ${job.jobId}\n\n${safeEvents.map((event) => `- ${event.name} (${event.eventId})`).join('\n')}\n\n## Source snapshots\n\n${copiedFiles.map((file) => `- [${file}](files/${file})`).join('\n')}\n`, 'utf8');
  await writeFile(join(inputDirectory, 'manifest.json'), `${JSON.stringify({ version: 1, excluded: ['args', 'rawStack', 'stdout', 'stderr', 'environment', 'authored-markdown'], events: safeEvents.length, files: copiedFiles }, null, 2)}\n`, 'utf8');
  const configured = process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND?.trim();
  // WHAT: Record unavailable Graphify when no pinned executable command is configured.
  // WHY: The tool must not silently download executable code during evidence processing.
  if (!configured) return { ...base, status: 'unavailable', argv: [], postProcessArgv: [], startedAt: null, finishedAt: null, durationMs: null, exitCode: null, signal: null, stdout: '', stderr: 'TRACE_EVIDENCE_GRAPHIFY_COMMAND is not configured.' };
  const command = JSON.parse(configured) as string[];
  // WHAT: Reject an invalid configured argv before spawning.
  // WHY: Graphify must use a direct executable and pinned argument boundary.
  if (!Array.isArray(command) || command.length === 0) throw new Error('invalid_graphify_command');
  const argv = [...command, 'extract', inputDirectory, '--output', join(job.artifactRoot, job.jobId), '--force', '--code-only', '--no-gitignore'];
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const ownsProcessGroup = process.platform !== 'win32';
  const child = spawn(argv[0], argv.slice(1), { cwd: join(job.artifactRoot, job.jobId), stdio: ['ignore', 'pipe', 'pipe'], env: graphifyEnvironment, detached: ownsProcessGroup });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  let timedOut = false;
  let escalation: NodeJS.Timeout | null = null;
  const signalChild = (childSignal: NodeJS.Signals) => { try { if (ownsProcessGroup && child.pid) process.kill(-child.pid, childSignal); else child.kill(childSignal); } catch { /* Concurrent settlement wins. */ } };
  const terminate = () => { signalChild('SIGTERM'); escalation = setTimeout(() => signalChild('SIGKILL'), 2_000); };
  const timer = setTimeout(() => { timedOut = true; terminate(); }, job.options.graphifyTimeoutMs ?? job.options.timeoutMs);
  signal?.addEventListener('abort', terminate, { once: true });
  const [exitCode, childSignal] = await once(child, 'close') as [number | null, NodeJS.Signals | null];
  clearTimeout(timer);
  // WHAT: Retire Graphify escalation after process-tree settlement.
  // WHY: A late signal must not target a recycled process identity.
  if (escalation) clearTimeout(escalation);
  signal?.removeEventListener('abort', terminate);
  const postProcessArgv = [...command, 'cluster-only', inputDirectory, '--graph', join(outputDirectory, 'graph.json'), '--no-label'];
  let postExitCode: number | null = null;
  // WHAT: Generate Graphify's report and HTML only after successful code extraction.
  // WHY: These are required output artifacts and clustering uses only the already sanitized local graph.
  if (exitCode === 0 && !timedOut && !signal?.aborted) {
    const post = spawn(postProcessArgv[0], postProcessArgv.slice(1), { cwd: join(job.artifactRoot, job.jobId), stdio: ['ignore', 'pipe', 'pipe'], env: graphifyEnvironment, detached: ownsProcessGroup });
    post.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; }); post.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    let postEscalation: NodeJS.Timeout | null = null;
    const terminatePost = () => { try { if (ownsProcessGroup && post.pid) process.kill(-post.pid, 'SIGTERM'); else post.kill('SIGTERM'); } catch { /* Concurrent settlement wins. */ } postEscalation = setTimeout(() => { try { if (ownsProcessGroup && post.pid) process.kill(-post.pid, 'SIGKILL'); else post.kill('SIGKILL'); } catch { /* Concurrent settlement wins. */ } }, 2_000); };
    const postTimer = setTimeout(() => { timedOut = true; terminatePost(); }, job.options.graphifyTimeoutMs ?? job.options.timeoutMs);
    signal?.addEventListener('abort', terminatePost, { once: true });
    const [settledPostCode] = await once(post, 'close') as [number | null, NodeJS.Signals | null]; postExitCode = settledPostCode; clearTimeout(postTimer); if (postEscalation) clearTimeout(postEscalation); signal?.removeEventListener('abort', terminatePost);
  }
  const finished = Date.now();
  return { ...base, status: signal?.aborted ? 'cancelled' : timedOut ? 'timed_out' : exitCode === 0 && postExitCode === 0 ? 'succeeded' : 'failed', argv, postProcessArgv, startedAt, finishedAt: new Date(finished).toISOString(), durationMs: finished - started, exitCode: postExitCode ?? exitCode, signal: childSignal, stdout, stderr };
}
