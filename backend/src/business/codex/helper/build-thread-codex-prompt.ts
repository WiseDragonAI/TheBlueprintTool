/**
 * WHAT: Builds a compact runtime contract and the current thread payload for Codex.
 * WHY: Repository AGENTS.md owns general policy; launch instructions contain only Decision OS mechanics.
 */
import { ledgerCliPromptLine } from './decision-os-codex-runtime.js';

export function buildThreadCodexPrompt(input: {
  workspaceRoot: string;
  ledgerFile: string;
  cardId: string;
  cardTitle: string;
  cardMarkdownFile: string;
  cardMarkdown: string;
  threadId: string;
  threadMarkdownFile: string;
  threadMarkdown: string;
  runSummaryFile: string;
  operatorNoteTimestamp: string;
}): { developerInstructions: string; taskContext: string } {
  const developerInstructions = [
    'Decision OS run:',
    `- ${ledgerCliPromptLine}`,
    '- Read context once: `ledger-cli session-context --ledger "$DECISION_OS_LEDGER_FILE" --card-id <card-id> --json`.',
    '- Use ledger-cli for ledger state. Never patch ledger JSON.',
    '- Keep the master active unless the operator explicitly authorizes completion.',
    '- Finish with one reply: `ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id <thread-id> --message-stdin`.',
    '- Card sections: lettered H2 headings, dividers, numbered lists, bold labels, exact values in backticks.',
  ].join('\n');

  const taskContext = [
    'Execute the operator request from this Decision OS thread.',
    `Card: ${input.cardId} (${input.cardMarkdownFile})`,
    `Thread: ${input.threadId} (${input.threadMarkdownFile})`,
    `Run summary: ${input.runSummaryFile}`,
    '',
    'Thread:',
    '```markdown',
    input.threadMarkdown,
    '```',
    '',
    'Card:',
    '```markdown',
    input.cardMarkdown,
    '```',
  ].join('\n');

  return { developerInstructions, taskContext };
}
