/**
 * WHAT: Converts one execution's diagnostic text into presentation-safe events.
 * WHY: Private segment markers must be removed before stderr diagnostics reach the browser.
 */
import { normalizeCardSkillRunDiagnostic } from './normalize-card-skill-run-event.js';
import { isCodexRunMarkerLine } from './codex-run-segment-marker.js';
import type { NormalizedRunEvent } from './card-skill-run-event-types.js';

export function taskExecutionPresentationDiagnostics(log: string): NormalizedRunEvent[] {
  const lines = log.replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !isCodexRunMarkerLine(line));
  const diagnostics: NormalizedRunEvent[] = [];
  const structuredStart = /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/;
  for (let index = 0; index < lines.length;) {
    // WHAT: Skip empty separators before identifying the next diagnostic record.
    // WHY: Blank stderr lines have no operator-facing diagnostic meaning.
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const startLine = index + 1;
    const record = [lines[index++]];
    // WHAT: Preserve stack and continuation lines with their structured diagnostic header.
    // WHY: Splitting a stack into unrelated messages destroys the actionable error context.
    if (structuredStart.test(record[0])) {
      while (index < lines.length && !structuredStart.test(lines[index])) record.push(lines[index++]);
    }
    while (record.at(-1)?.trim() === '') record.pop();
    diagnostics.push(normalizeCardSkillRunDiagnostic({ line: startLine, text: record.join('\n') }));
  }
  return diagnostics;
}
