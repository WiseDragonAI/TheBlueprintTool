/**
 * WHAT: Renders one factual Markdown report from finalized trace evidence.
 * WHY: Agents need a readable inventory without programmatic diagnosis or causal judgment.
 */
import type { TraceJob, RawTelemetryEvent } from '../../../lib/types.js';
import type { MappedEventStack } from '../../stack/helper/map-telemetry-stacks.js';

export function renderReport(input: { job: TraceJob; tests: unknown[]; telemetry: RawTelemetryEvent[]; stacks: MappedEventStack[]; graphify: unknown; flow?: unknown; logs?: { stdout: string; stderr: string }; taskEvidence?: { inventory: string; presentation: string }; sourceFiles?: unknown }): string {
  const lines = [`# Trace Evidence Report`, '', `## A. Job`, '', `1. **Job:** \`${input.job.jobId}\``, `2. **Phase:** \`${input.job.phase}\``, `3. **Adapter:** \`${input.job.adapter}\``, `4. **Scopes:** \`${input.job.scopes.length}\``, '', '---', '', '## B. Test Results', '', '```json', JSON.stringify(input.tests, null, 2), '```', '', '---', '', '## C. Telemetry', ''];
  for (const event of input.telemetry) lines.push(`1. \`${event.sequence}\` \`${event.name}\` — \`${event.emittedAt}\` — event \`${event.eventId}\``);
  lines.push('', '---', '', '## D. Event Stacks', '');
  for (const stack of input.stacks) {
    lines.push(`### ${stack.name} — \`${stack.eventId}\``, '', '```text', stack.rawStack, '```', '', 'Mapped frames:', '');
    for (const frame of stack.frames) lines.push(`1. \`${frame.originalFile ?? frame.generatedFile}:${frame.originalLine ?? frame.generatedLine}:${frame.originalColumn ?? frame.generatedColumn}\`${frame.failure ? ` — ${frame.failure}` : ''}`);
    lines.push('');
  }
  lines.push('---', '', '## E. Mechanical Flow', '', '```json', JSON.stringify(input.flow ?? {}, null, 2), '```', '', '---', '', '## F. Task Evidence', '', '### Scope inventory', '', '```jsonl', input.taskEvidence?.inventory ?? '', '```', '', '### Selected execution presentation', '', '```jsonl', input.taskEvidence?.presentation ?? '', '```', '', 'Raw Codex content remains in its access-controlled hashed artifact and is not copied into this derived report.', '', '---', '', '## G. Captured Logs', '', '### stdout', '', '```text', input.logs?.stdout ?? '', '```', '', '### stderr', '', '```text', input.logs?.stderr ?? '', '```', '', '---', '', '## H. Source Files', '', '```json', JSON.stringify(input.sourceFiles ?? [], null, 2), '```', '', '---', '', '## I. Graphify', '', '```json', JSON.stringify(input.graphify, null, 2), '```', '', '---', '', '## J. Artifacts', '');
  for (const artifact of input.job.artifacts) lines.push(`1. \`${artifact.path}\` — ${artifact.bytes} bytes — SHA-256 \`${artifact.sha256}\` — complete \`${artifact.complete}\``);
  lines.push('', '---', '', '## K. Completeness and Collection Failures', '', '```json', JSON.stringify({ failures: input.job.failures, parseFailures: input.job.parseFailures ?? [], droppedRecords: input.job.droppedRecords ?? [] }, null, 2), '```', '');
  return lines.join('\n');
}
