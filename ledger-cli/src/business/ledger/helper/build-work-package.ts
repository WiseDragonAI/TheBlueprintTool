/**
 * WHAT: Builds one bounded subagent work package from an explicit prompt, input cards, and output target.
 * WHY: subagents must not spend turns rediscovering prompts, project state, or card ownership.
 */
import type { Result } from '../../../lib/types.js';
import { readCardMarkdown } from './read-card-markdown.js';
import { queryPipelinePrompts } from '../../prompt/helper/query-pipeline-prompts.js';

export async function buildWorkPackage(input: {
  cardIds?: string[];
  outputCardId?: string;
  outputPath?: string;
  promptName?: string;
}): Promise<Result<string>> {
  const promptName = String(input.promptName ?? '').trim();
  const outputCardId = String(input.outputCardId ?? '').trim();
  const outputPath = String(input.outputPath ?? '').trim();
  const cardIds = (input.cardIds ?? []).map((cardId) => String(cardId).trim()).filter(Boolean);
  if (!promptName) return { ok: false, error: 'work-package requires --prompt.' };
  if (cardIds.length === 0) return { ok: false, error: 'work-package requires --input-card-id.' };
  if (!outputCardId) return { ok: false, error: 'work-package requires --output-card-id.' };
  if (!outputPath) return { ok: false, error: 'work-package requires --output-path.' };
  const [prompt, cards] = await Promise.all([
    queryPipelinePrompts({ action: 'query', names: [promptName] }),
    readCardMarkdown({ cardIds, includeThreads: false }),
  ]);
  if (!prompt.ok) return prompt;
  if (!cards.ok) return cards;
  return { ok: true, value: [
    '# Assigned Work Package',
    '',
    `- Output card ID: \`${outputCardId}\``,
    `- Output path: \`${outputPath}\``,
    '',
    'Write the required artifact directly to the output path and return only the result required by the assigned prompt.',
    '',
    '---',
    '',
    prompt.value,
    '',
    '---',
    '',
    '# Explicit Input Cards',
    '',
    cards.value,
  ].join('\n') };
}
