/**
 * WHAT: Flushes one Codex run ingestor at process settlement with scoped error reporting.
 * WHY: Every process controller needs identical best-effort settlement behavior without duplicating try/catch branches.
 */
import { type CardSkillRunEventIngestor } from '../helper/card-skill-run-event-types.js';

export function flushCardSkillRunEventIngestor(ingestor: CardSkillRunEventIngestor, runId: string): void {
  try {
    ingestor.flush();
  } catch (error) {
    // WHAT: Report settlement persistence failure without hiding the child process result.
    // WHY: Run completion and thread ingestion have separate observable outcomes.
    console.error(`Could not flush Codex run events for ${runId}:`, error);
  }
}
