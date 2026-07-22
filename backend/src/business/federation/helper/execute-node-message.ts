/**
 * WHAT: Executes one authenticated federation message as a headless Codex turn in a target project.
 * WHY: A peer must be able to ask the node itself for repository evidence under that node's workspace instructions.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { decisionOsCodexEnvironment } from '../../codex/helper/decision-os-codex-runtime.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../../codex/helper/resolve-codex-command.js';
import { signalCodexProcessTree } from '../../codex/helper/reconcile-terminal-codex-process.js';
import type { CodexSlotAcquireOptions } from '../../codex/helper/codex-capacity-slots.js';

type AnyRecord = Record<string, unknown>;

export type NodeMessageExecutionResult = {
  ok: true;
  runId: string;
  requesterNodeId: string;
  executorNodeId: string;
  executorNodeLabel: string;
  projectId: string;
  answer: string;
  status: 'complete';
  model: string;
  effort: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  artifacts: {
    manifest: string;
    stdout: string;
    stderr: string;
  };
};

const maximumMessageBytes = 64 * 1024;
const maximumSlotWaitMs = 60_000;

function safeNodeId(value: unknown): string {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
}

function lastAgentAnswer(line: string): string {
  try {
    const event = JSON.parse(line) as AnyRecord;
    const item = event.item && typeof event.item === 'object' ? event.item as AnyRecord : {};
    return event.type === 'item.completed' && item.type === 'agent_message' ? String(item.text ?? '').trim() : '';
  } catch {
    return '';
  }
}

function relativeArtifact(projectRoot: string, file: string): string {
  return relative(projectRoot, file).replaceAll('\\', '/');
}

function writeManifest(file: string, value: AnyRecord): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function executeNodeMessage(input: {
  project: DecisionOsProject;
  runtime: AnyRecord;
  requesterNodeId: string;
  executorNodeId: string;
  executorNodeLabel: string;
  message: string;
  codexModel?: unknown;
  codexEffort?: unknown;
  signal?: AbortSignal;
}): Promise<NodeMessageExecutionResult> {
  const message = String(input.message ?? '').trim();
  if (!message) throw new RangeError('Node message is required.');
  if (Buffer.byteLength(message, 'utf8') > maximumMessageBytes) throw new RangeError('Node message exceeds 64 KiB.');
  if (input.codexModel !== undefined && input.codexModel !== null && !isAllowedCodexModel(input.codexModel)) {
    throw new RangeError('Unsupported Codex model.');
  }
  if (input.codexEffort !== undefined && input.codexEffort !== null && !isAllowedCodexEffort(input.codexEffort)) {
    throw new RangeError('Unsupported Codex effort.');
  }
  if (input.signal?.aborted) throw new Error('Node message was cancelled before execution.');
  const ledger = input.project.ledgers.find((entry) => entry.id === 'tasks') ?? input.project.ledgers[0];
  if (!ledger) throw new Error('Target project has no Decision OS ledger.');
  const ledgerFile = resolve(input.project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));

  const acquire = input.runtime.acquireProjectSyncCodexSlot;
  const release = typeof acquire === 'function'
    ? await (acquire as (options: CodexSlotAcquireOptions) => Promise<() => void>)({
      signal: input.signal,
      timeoutMs: maximumSlotWaitMs,
    })
    : () => undefined;
  try {
    if (input.signal?.aborted) throw new Error('Node message was cancelled before execution.');
    const startedAt = new Date().toISOString();
    const runId = `node-message-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const artifactRoot = resolve(input.project.decisionOsRoot, 'runs', 'node-messages');
    mkdirSync(artifactRoot, { recursive: true });
    const stdoutFile = resolve(artifactRoot, `${runId}.jsonl`);
    const stderrFile = resolve(artifactRoot, `${runId}.log`);
    const manifestFile = resolve(artifactRoot, `${runId}.json`);
    const artifacts = {
      manifest: relativeArtifact(input.project.root, manifestFile),
      stdout: relativeArtifact(input.project.root, stdoutFile),
      stderr: relativeArtifact(input.project.root, stderrFile),
    };
    const command = resolveCodexCommand({
      workspaceRoot: input.project.root,
      runtime: input.runtime,
      codexModel: input.codexModel,
      codexEffort: input.codexEffort,
    });
    const baseManifest: AnyRecord = {
      version: 1,
      runId,
      requesterNodeId: input.requesterNodeId,
      executorNodeId: input.executorNodeId,
      executorNodeLabel: input.executorNodeLabel,
      projectId: input.project.id,
      projectName: input.project.name,
      status: 'running',
      model: command.model,
      effort: command.effort,
      startedAt,
      finishedAt: null,
      error: '',
      artifacts,
    };
    writeManifest(manifestFile, baseManifest);

    const prompt = [
      'You are answering a direct request from another Decision OS federation node.',
      `Requester node: ${safeNodeId(input.requesterNodeId) || 'unknown'}`,
      `Executor node: ${safeNodeId(input.executorNodeId) || 'local'}`,
      `Target project: ${input.project.id}`,
      '',
      'Follow every instruction loaded from this target workspace, including AGENTS.md. Inspect the repository and runtime evidence needed to answer. Return a concise, evidence-backed answer to the request.',
      '',
      '## Request',
      '',
      message,
    ].join('\n');

    return await new Promise<NodeMessageExecutionResult>((resolvePromise, reject) => {
      const stdout = createWriteStream(stdoutFile, { flags: 'wx' });
      const stderr = createWriteStream(stderrFile, { flags: 'wx' });
      const child = spawn(command.command, command.args, {
        cwd: input.project.root,
        env: decisionOsCodexEnvironment({ runtime: input.runtime, decisionOsRoot: input.project.decisionOsRoot, ledgerFile }),
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      let answer = '';
      let remainder = '';
      let stderrTail = '';
      let settled = false;
      let forceKillTimer: NodeJS.Timeout | null = null;

      const onAbort = (): void => {
        signalCodexProcessTree({ child, signal: 'SIGTERM' });
        forceKillTimer = setTimeout(() => signalCodexProcessTree({ child, signal: 'SIGKILL' }), 2_000);
        forceKillTimer.unref?.();
      };
      input.signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout.on('data', (chunk: Buffer) => {
        stdout.write(chunk);
        remainder += chunk.toString('utf8');
        const lines = remainder.split('\n');
        remainder = lines.pop() ?? '';
        for (const line of lines) answer = lastAgentAnswer(line) || answer;
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr.write(chunk);
        stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-8_192);
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(prompt);

      const settle = async (error: Error | null, exitCode: number | null): Promise<void> => {
        if (settled) return;
        settled = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        input.signal?.removeEventListener('abort', onAbort);
        if (remainder) answer = lastAgentAnswer(remainder) || answer;
        await Promise.all([
          new Promise<void>((resolveStream) => stdout.end(resolveStream)),
          new Promise<void>((resolveStream) => stderr.end(resolveStream)),
        ]);
        const finishedAt = new Date().toISOString();
        const cancelled = Boolean(input.signal?.aborted);
        const failure = error?.message
          || (cancelled ? 'Node message execution was cancelled.' : '')
          || (exitCode !== 0 ? `Codex exited with code ${exitCode ?? 'unknown'}: ${stderrTail.trim() || 'no diagnostic'}` : '')
          || (!answer ? 'Codex completed without an agent answer.' : '');
        if (failure) {
          writeManifest(manifestFile, { ...baseManifest, status: cancelled ? 'cancelled' : 'failed', finishedAt, error: failure, exitCode });
          reject(new Error(failure));
          return;
        }
        const result: NodeMessageExecutionResult = {
          ok: true,
          runId,
          requesterNodeId: input.requesterNodeId,
          executorNodeId: input.executorNodeId,
          executorNodeLabel: input.executorNodeLabel,
          projectId: input.project.id,
          answer,
          status: 'complete',
          model: command.model,
          effort: command.effort,
          startedAt,
          finishedAt,
          durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
          artifacts,
        };
        writeManifest(manifestFile, { ...baseManifest, ...result });
        resolvePromise(result);
      };
      child.once('error', (error) => { void settle(error, null); });
      child.once('close', (code) => { void settle(null, code); });
    });
  } finally {
    release();
  }
}
