/**
 * WHAT: Node process adapter for command execution.
 * WHY: report mode and git worktree creation cross the process boundary.
 */
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessPort } from '../types.js';

const execAsync = promisify(execCallback);

export const nodeProcess: ProcessPort = {
  async exec(command, cwd) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        maxBuffer: 1024 * 1024 * 20,
      });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string; message?: string };
      return {
        exitCode: typeof failure.code === 'number' ? failure.code : 1,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? failure.message ?? '',
      };
    }
  },
};
