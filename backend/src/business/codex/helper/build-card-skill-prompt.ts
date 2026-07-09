/**
 * WHAT: Builds the stdin prompt for a card-scoped Codex skill run.
 * WHY: Headless Codex needs the selected skill, source card content, and output file contract in one deterministic payload.
 */
export function buildCardSkillPrompt(input: {
  skillName: string;
  sourceCardId: string;
  sourceCardTitle: string;
  sourceCardContent: string;
  outputMarkdownFile: string;
}): string {
  return [
    `$${input.skillName}`,
    '',
    'You are processing one decision-os card from the active workspace.',
    '',
    'Treat the following source card as the complete incoming card content for this run.',
    '',
    `Source card id: ${input.sourceCardId}`,
    `Source card title: ${input.sourceCardTitle}`,
    '',
    'Source card content:',
    '```markdown',
    input.sourceCardContent,
    '```',
    '',
    `Write the final result to this Markdown file: ${input.outputMarkdownFile}`,
    '',
    'Use English only.',
    'Do not edit the source card.',
    'Do not edit ledger JSON manually.',
    'Keep unrelated files unchanged.',
    'When finished, ensure the Markdown file contains the useful result for the operator.',
  ].join('\n');
}
