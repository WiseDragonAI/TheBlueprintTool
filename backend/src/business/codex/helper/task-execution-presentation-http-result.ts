/**
 * WHAT: Maps a task execution presentation result to one HTTP status and JSON body.
 * WHY: Local and authenticated remote reads must expose the same success and failure contract.
 */
import type { TaskExecutionPresentation } from '../../../../../shared/schemas/task-execution-presentation-types.js';

type PresentationResult =
  | { ok: true; presentation: TaskExecutionPresentation }
  | { ok: false; statusCode: number; error: string };

export function taskExecutionPresentationHttpResult(
  executionId: string,
  result: PresentationResult,
): { statusCode: number; body: string } {
  return 'presentation' in result
    ? { statusCode: 200, body: JSON.stringify(result.presentation) }
    : {
      statusCode: result.statusCode,
      body: JSON.stringify({ ok: false, error: result.error, executionId }),
    };
}
