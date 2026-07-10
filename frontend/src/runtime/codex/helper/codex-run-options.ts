/**
 * WHAT: Re-exports and validates the shared Codex run-option catalog for frontend controls.
 * WHY: Browser controls and backend command resolution must consume one authoritative option list.
 */
import {
  codexEffortOptions,
  codexModelOptions,
  type CodexEffort,
  type CodexModel,
} from '../../../../../shared/schemas/codex-pipeline-types.js';

export { codexEffortOptions, codexModelOptions };
export type { CodexEffort, CodexModel };

export function isCodexModel(value: unknown): value is CodexModel {
  return typeof value === 'string' && (codexModelOptions as readonly string[]).includes(value);
}

export function isCodexEffort(value: unknown): value is CodexEffort {
  return typeof value === 'string' && (codexEffortOptions as readonly string[]).includes(value);
}
