import { spawn } from 'node:child_process';

async function collectTrackedChunk(input: { paths: string[]; workspaceRoot: string }): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', input.workspaceRoot, 'ls-files', '-z', '--', ...input.paths], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        const output = Buffer.concat(stdout).toString('utf8');
        resolve(new Set(output.split('\0').filter(Boolean)));
        return;
      }
      const message = Buffer.concat(stderr).toString('utf8').trim();
      if (/not a git repository/i.test(message)) {
        resolve(new Set());
        return;
      }
      reject(new Error(message || `git ls-files failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

export async function collectGitTrackedPaths(input: { paths: string[]; workspaceRoot: string }): Promise<Set<string>> {
  const paths = Array.from(new Set(input.paths)).filter(Boolean).sort();
  if (paths.length === 0) return new Set();

  const tracked = new Set<string>();
  for (let index = 0; index < paths.length; index += 500) {
    const chunk = paths.slice(index, index + 500);
    for (const path of await collectTrackedChunk({ paths: chunk, workspaceRoot: input.workspaceRoot })) {
      tracked.add(path);
    }
  }
  return tracked;
}
