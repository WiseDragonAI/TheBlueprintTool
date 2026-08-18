/**
 * WHAT: Runs pinned Graphify against an isolated copy of the current codebase source with a bounded process lifetime.
 * WHY: Dependency extraction must match the filesystem bytes parsed by the quality mapper without ingesting unrelated data.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function runQualityGraphify(corpus: string, output: string, timeoutMs: number): Promise<string> {
  const configured = process.env.QUALITY_MAP_GRAPHIFY_COMMAND?.trim();
  const command = /* WHAT: Honor explicit direct argv before the pinned default. WHY: CI may provide a preinstalled Graphify executable. */ configured ? JSON.parse(configured) as string[] : ['uvx', '--from', 'graphifyy==0.9.22', 'graphify'];
  // WHAT: Reject malformed configured executable argv before process creation.
  // WHY: A shell string cannot preserve the pinned Graphify execution boundary.
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !part)) throw new Error('invalid_quality_map_graphify_command');
  const argv = [...command, 'extract', corpus, '--output', output, '--force', '--code-only', '--no-cluster', '--no-gitignore'];
  const ownsGroup = process.platform !== 'win32';
  const environment = Object.fromEntries(['PATH', 'HOME', 'XDG_CACHE_HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NO_COLOR'].flatMap((name) => /* WHAT: Include only configured allowlisted variables. WHY: Graphify must not receive repository credentials. */ process.env[name] === undefined ? [] : [[name, process.env[name] as string]]));
  const child = spawn(argv[0], argv.slice(1), { cwd: corpus, detached: ownsGroup, stdio: ['ignore', 'pipe', 'pipe'], env: environment });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  let timedOut = false;
  const terminate = (signal: NodeJS.Signals): void => {
    // WHAT: Signal the complete Graphify process group when the platform supports it.
    // WHY: Timeouts must not orphan Graphify workers.
    if (ownsGroup && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      // WHAT: Signal the direct child on platforms without process-group ownership.
      // WHY: The timeout still requires explicit child settlement.
      child.kill(signal);
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    terminate('SIGTERM');
    setTimeout(() => terminate('SIGKILL'), 2_000).unref();
  }, timeoutMs);
  const [code] = await once(child, 'close') as [number | null, NodeJS.Signals | null];
  clearTimeout(timer);
  // WHAT: Report timeout independently from ordinary extraction failure.
  // WHY: Agents need to distinguish capacity limits from malformed source graphs.
  if (timedOut) throw new Error('quality_map_graphify_timeout');
  // WHAT: Preserve Graphify stderr when extraction fails.
  // WHY: A missing graph cannot be normalized into trustworthy dependencies.
  if (code !== 0) throw new Error(`quality_map_graphify_failed:${stderr.trim()}`);
  const graphPath = join(output, 'graphify-out', 'graph.json');
  // WHAT: Require Graphify's machine graph after successful settlement.
  // WHY: Process exit alone does not prove static evidence exists.
  if (!existsSync(graphPath)) throw new Error(`quality_map_graph_missing:${graphPath}`);
  return graphPath;
}
