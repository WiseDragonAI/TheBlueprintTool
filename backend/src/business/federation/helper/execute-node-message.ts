/**
 * WHAT: Executes one authenticated federation message as a headless Codex turn in a target project.
 * WHY: A peer must be able to ask the node itself for repository evidence under that node's workspace instructions.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { decisionOsCodexEnvironment } from '../../codex/helper/decision-os-codex-runtime.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../../codex/helper/resolve-codex-command.js';
import { signalCodexProcessTree } from '../../codex/helper/reconcile-terminal-codex-process.js';
import type { CodexSlotAcquireOptions } from '../../codex/helper/codex-capacity-slots.js';
import { codexExecutionTimeoutMs } from '../../codex/helper/codex-runtime-run-store.js';

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
const maximumExecutionOutputBytes = 32 * 1024 * 1024;

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
      const promptFile = `${stderrFile}.${runId}.stdin`;
      writeFileSync(promptFile, prompt, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      let stdinDescriptor: number | undefined;
      let stdoutDescriptor: number | undefined;
      let stderrDescriptor: number | undefined;
      let child;
      try {
        stdinDescriptor = openSync(promptFile, 'r');
        stdoutDescriptor = openSync(stdoutFile, 'wx');
        stderrDescriptor = openSync(stderrFile, 'wx');
        child = spawn(command.command, command.args, {
          cwd: input.project.root,
          env: decisionOsCodexEnvironment({ runtime: input.runtime, decisionOsRoot: input.project.decisionOsRoot, ledgerFile }),
          stdio: [stdinDescriptor, stdoutDescriptor, stderrDescriptor],
          detached: process.platform !== 'win32',
        });
      } finally {
        if (stdinDescriptor !== undefined) closeSync(stdinDescriptor);
        if (stdoutDescriptor !== undefined) closeSync(stdoutDescriptor);
        if (stderrDescriptor !== undefined) closeSync(stderrDescriptor);
        if (existsSync(promptFile)) unlinkSync(promptFile);
      }
      child.unref();
      let settled = false;
      let forceKillTimer: NodeJS.Timeout | null = null;
      let forcedSettlementTimer: NodeJS.Timeout | null = null;
      let pendingFailure: Error | null = null;
      let settle!: (error: Error | null, exitCode: number | null) => Promise<void>;
      const executionTimeout = codexExecutionTimeoutMs(input.runtime);

      const stop = (error: Error): void => {
        if (pendingFailure) return;
        pendingFailure = error;
        signalCodexProcessTree({ child, signal: 'SIGTERM' });
        forceKillTimer = setTimeout(() => signalCodexProcessTree({ child, signal: 'SIGKILL' }), 2_000);
        forceKillTimer.unref?.();
        forcedSettlementTimer = setTimeout(() => { void settle(error, null); }, 5_000);
        // WHAT: Keep the final bounded settlement deadline referenced.
        // WHY: A detached child that omits close must still release the awaited slot.
        forcedSettlementTimer.ref?.();
      };
      const onAbort = (): void => stop(new Error('Node message execution was cancelled.'));
      input.signal?.addEventListener('abort', onAbort, { once: true });
      const outputLimitTimer = setInterval(() => {
        try {
          const outputBytes = (existsSync(stdoutFile) ? statSync(stdoutFile).size : 0)
            + (existsSync(stderrFile) ? statSync(stderrFile).size : 0);
          if (outputBytes > maximumExecutionOutputBytes) {
            stop(new Error(`Node message execution exceeded ${maximumExecutionOutputBytes} output bytes.`));
          }
        } catch (error) {
          stop(error instanceof Error ? error : new Error(String(error)));
        }
      }, 50);
      outputLimitTimer.unref?.();

      settle = async (error: Error | null, exitCode: number | null): Promise<void> => {
        if (settled) return;
        settled = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        if (forcedSettlementTimer) clearTimeout(forcedSettlementTimer);
        clearTimeout(executionDeadline);
        clearInterval(outputLimitTimer);
        input.signal?.removeEventListener('abort', onAbort);
        try {
          const stdout = existsSync(stdoutFile) ? readFileSync(stdoutFile, 'utf8') : '';
          const stderr = existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
          if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maximumExecutionOutputBytes) {
            error = new Error(`Node message execution exceeded ${maximumExecutionOutputBytes} output bytes.`);
          }
          const answer = stdout.split('\n').reduce((current, line) => lastAgentAnswer(line) || current, '');
          const stderrTail = stderr.slice(-8_192);
          const finishedAt = new Date().toISOString();
          const cancelled = Boolean(input.signal?.aborted);
          const failure = (error ?? pendingFailure)?.message
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
        } catch (settlementError) {
          reject(settlementError);
        }
      };
      const executionDeadline = setTimeout(() => stop(new Error(`Node message execution exceeded ${executionTimeout}ms.`)), executionTimeout);
      // WHAT: Keep one finite lifecycle owner referenced while execution is awaited.
      // WHY: Detached children do not keep their completion callbacks observable.
      executionDeadline.ref?.();
      child.once('error', (error) => { void settle(error, null); });
      child.once('close', (code) => { void settle(null, code); });
    });
  } finally {
    release();
  }
}
