/**
 * WHAT: Resolves the durable Codex model-and-effort pair stored on one card.
 * WHY: Every Codex entry point and mounted selector must share one validated preference source.
 */
import { state } from '../../state.js';
import { isCodexEffort, isCodexModel, type CodexEffort, type CodexModel } from './codex-run-options.js';

export type CardCodexRunPreference = {
  model: CodexModel;
  effort: CodexEffort;
};

export const defaultCardCodexRunPreference: CardCodexRunPreference = {
  model: 'gpt-5.6-sol',
  effort: 'high',
};

export function cardCodexRunPreference(card: Record<string, unknown> | null | undefined): CardCodexRunPreference {
  if (!isCodexModel(card?.codexRunModel) || !isCodexEffort(card?.codexRunEffort)) {
    return { ...defaultCardCodexRunPreference };
  }
  return {
    model: card.codexRunModel,
    effort: card.codexRunEffort,
  };
}

export function activeCardCodexRunPreference(cardId: string): CardCodexRunPreference {
  const card = state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId);
  return cardCodexRunPreference(card);
}
