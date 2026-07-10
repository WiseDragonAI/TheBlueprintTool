/**
 * WHAT: Builds the deterministic prompt for one skill inside a durable pipeline run.
 * WHY: Every isolated Codex process needs explicit source, stage input, and output ownership.
 */
export function buildPipelineSkillPrompt(input: {
  skillName: string;
  ledgerFile: string;
  pipelineRunId: string;
  pipelineName: string;
  sourceCardId: string;
  sourceCardTitle: string;
  stepId: string;
  stepTitle: string;
  stepInputCardId: string;
  stepInputCardContent: string;
  outputCardId: string;
  outputMarkdownFile: string;
}): string {
  return [
    `$${input.skillName}`,
    '',
    'You are processing one stage of a decision-os card pipeline from the active workspace.',
    '',
    `Pipeline run id: ${input.pipelineRunId}`,
    `Pipeline: ${input.pipelineName}`,
    `Ledger file: ${input.ledgerFile}`,
    `Source card id: ${input.sourceCardId}`,
    `Source card title: ${input.sourceCardTitle}`,
    `Active step id: ${input.stepId}`,
    `Active step title: ${input.stepTitle}`,
    `Current skill: ${input.skillName}`,
    `Input card id: ${input.stepInputCardId}`,
    `Output card id: ${input.outputCardId}`,
    '',
    'Input card content:',
    '```markdown',
    input.stepInputCardContent,
    '```',
    '',
    `Write the final result to this Markdown file: ${input.outputMarkdownFile}`,
    '',
    'Use English only.',
    'Do not edit the source card or any other pipeline step card.',
    'Do not edit ledger JSON manually.',
    'Keep unrelated files unchanged.',
    'When finished, ensure the output Markdown file contains the useful result for the operator and the next pipeline skill.',
  ].join('\n');
}
