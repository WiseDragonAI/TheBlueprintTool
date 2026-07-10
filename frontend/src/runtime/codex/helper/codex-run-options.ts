/**
 * WHAT: Defines the Codex model and reasoning-effort choices exposed by frontend run controls.
 * WHY: Skill launch and session continuation must submit the same backend-supported values.
 */
export const codexModelOptions = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'] as const;
export const codexEffortOptions = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;
