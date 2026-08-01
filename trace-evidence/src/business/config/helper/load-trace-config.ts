/**
 * WHAT: Loads the small repository-owned trace adapter and default configuration contract.
 * WHY: New repositories must replace adapters and defaults without changing reusable controllers.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type TraceConfig = { adapter: string; artifacts: string; graphifyVersion: string; graphifyDefaultScope: 'off' | 'touched' | 'all' };

export async function loadTraceConfig(repoRoot: string): Promise<TraceConfig> {
  const path = resolve(repoRoot, 'trace.config.yaml');
  const text = await readFile(path, 'utf8').catch(() => '');
  const field = (name: string) => text.match(new RegExp(`^\\s*${name}:\\s*([^#\\n]+)`, 'm'))?.[1].trim() ?? '';
  const graphifyDefaultScope = field('defaultScope') || 'touched';
  // WHAT: Reject unsupported configured Graphify scope before accepting jobs.
  // WHY: Repository configuration cannot introduce an unhandled execution mode.
  if (!['off', 'touched', 'all'].includes(graphifyDefaultScope)) throw new Error(`invalid_trace_configuration:${path}:defaultScope`);
  return { adapter: field('adapter') || 'decision-os', artifacts: field('artifacts') || '.trace/jobs', graphifyVersion: field('version') || '0.9.22', graphifyDefaultScope: graphifyDefaultScope as TraceConfig['graphifyDefaultScope'] };
}
