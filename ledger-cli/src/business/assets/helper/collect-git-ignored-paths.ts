import { spawn } from 'node:child_process';

export async function collectGitIgnoredPaths(input: { paths: string[]; workspaceRoot: string }): Promise<Set<string>> {
  const paths = Array.from(new Set(input.paths)).filter(Boolean).sort();
  if (paths.length === 0) return new Set();

  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', input.workspaceRoot, 'check-ignore', '-z', '--stdin'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || code === 1) {
        const output = Buffer.concat(stdout).toString('utf8');
        resolve(new Set(output.split('\0').filter(Boolean)));
        return;
      }
      const message = Buffer.concat(stderr).toString('utf8').trim();
      if (/not a git repository/i.test(message)) {
        resolve(new Set());
        return;
      }
      reject(new Error(message || `git check-ignore failed with exit code ${code ?? 'unknown'}`));
    });

    child.stdin.end(`${paths.join('\0')}\0`);
  });
}
