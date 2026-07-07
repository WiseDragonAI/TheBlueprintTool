/**
 * WHAT: Starts a selected card skill run and refreshes the active canvas.
 * WHY: The new output card and relationship are server-authored ledger state.
 */
import { state } from '../../state.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestCardSkillProcess } from '../effect/request-card-skill-process.js';

export async function processCardSkillController(input: { cardId: string; skillName: string; codexModel?: string; codexEffort?: string }): Promise<boolean> {
  const ledgerId = String(state.activeTab ?? '').trim();
  if (!ledgerId || !input.cardId || !input.skillName) return false;
  telemetry('codex-skill-process-start', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
  const result = await requestCardSkillProcess({ ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel, codexEffort: input.codexEffort });
  if (!result.ok) {
    telemetry('codex-skill-process-failed', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
    return false;
  }
  await refreshRuntimeState();
  telemetry('codex-skill-process-created-card', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: result.run?.id ?? '' });
  return true;
}
