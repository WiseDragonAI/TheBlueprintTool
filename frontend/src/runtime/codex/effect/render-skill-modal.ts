/**
 * WHAT: Preserves the legacy card-skill module exports inside the combined Process card flow.
 * WHY: Existing callers can keep their direct-skill commands while the visible entry point owns both tabs.
 */
import {
  closeCardProcessModal,
  openCardProcessModal,
  processModalState,
  processSelectedCardSkill as processSelectedSkill,
  selectProcessSkill,
} from './render-card-process-modal.js';

export { processModalState as skillModalState };

export async function openCardSkillModal(cardId: string): Promise<void> {
  await openCardProcessModal(cardId, 'skills');
}

export function selectCardSkill(skillName: string): void {
  selectProcessSkill(skillName);
}

export async function processSelectedCardSkill(): Promise<void> {
  await processSelectedSkill();
}

export function closeCardSkillModal(): void {
  closeCardProcessModal();
}
