/** Runs one canonical project-sync Codex role from the participant repository root. */
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveCodexCommand } from '../../codex/helper/resolve-codex-command.js';
import { buildProjectSyncPrompt } from '../helper/build-project-sync-prompt.js';
import type { ProjectSyncRole } from '../helper/project-sync-types.js';
import type { RepositorySyncStatus } from '../helper/repository-sync-status.js';

function jsonObjects(value: unknown): Record<string, unknown>[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [parsed as Record<string, unknown>, ...jsonObjects(parsed)] : [];
    } catch { return []; }
  }
  if (Array.isArray(value)) return value.flatMap(jsonObjects);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(jsonObjects);
  return [];
}

export async function startProjectSyncCodex(input: {
  projectRoot: string;
  runtime: Record<string, unknown>;
  syncId: string;
  nodeId: string;
  initiatorNodeId: string;
  role: ProjectSyncRole;
  requiredSha?: string;
  snapshot: RepositorySyncStatus;
}): Promise<{ codexRunId: string; result: Record<string, unknown> }> {
  const codexRunId = `project-sync-${randomUUID()}`;
  const prompt = buildProjectSyncPrompt(input);
  const command = resolveCodexCommand({ workspaceRoot: input.projectRoot, runtime: input.runtime });
  const acquire = input.runtime.acquireProjectSyncCodexSlot;
  const release = typeof acquire === 'function' ? await (acquire as () => Promise<() => void>)() : () => undefined;
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, { cwd: input.projectRoot, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => { release(); reject(error); });
    child.once('close', (code) => {
      release();
      if (code !== 0) {
        reject(new Error(`Codex ${input.role} exited with code ${code}: ${stderr.trim() || 'no diagnostic'}`));
        return;
      }
      const candidates = stdout.split('\n').filter(Boolean).flatMap((line) => {
        try { return jsonObjects(JSON.parse(line)); } catch { return jsonObjects(line); }
      });
      const result = candidates.reverse().find((entry) => 'status' in entry && ('headSha' in entry || 'blocker' in entry));
      if (!result) {
        reject(new Error(`Codex ${input.role} did not return the required JSON evidence.`));
        return;
      }
      if (String(result.status ?? '').toLowerCase() !== 'complete' && String(result.status ?? '').toLowerCase() !== 'completed') {
        reject(new Error(String(result.blocker ?? `Codex ${input.role} did not complete.`)));
        return;
      }
      resolve({ codexRunId, result });
    });
    child.stdin.end(prompt);
  });
}
