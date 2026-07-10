/**
 * WHAT: Reads object-shaped events from a Codex JSONL artifact with physical line numbers.
 * WHY: Stable line identity supports deterministic note IDs and continuation boundaries.
 */
import { existsSync, readFileSync } from 'node:fs';
import { type ParsedRunLine } from './card-skill-run-event-types.js';

type AnyRecord = Record<string, unknown>;

export function readCardSkillRunEventLines(file: string): ParsedRunLine[] {
  // WHAT: Treat an absent run artifact as an empty event stream.
  // WHY: Status reads may arrive before the child creates its stdout file.
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').flatMap((line, index) => {
    // WHAT: Ignore blank physical lines while retaining source indices for later events.
    // WHY: Event IDs must reflect the actual JSONL line position.
    if (!line.trim()) return [];
    try {
      const parsed = JSON.parse(line) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [{ line: index + 1, event: parsed as AnyRecord }] : [];
    } catch {
      // WHAT: Skip malformed lines without stopping later event inspection.
      // WHY: A partially written final line is expected while the run is active.
      return [];
    }
  });
}
