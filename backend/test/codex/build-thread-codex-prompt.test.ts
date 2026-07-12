import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreadCodexPrompt } from '@backend/business/codex/helper/build-thread-codex-prompt.js';

test('thread Codex prompt uses a direct scoped contract without triggering open-note skills', () => {
  const prompt = buildThreadCodexPrompt({
    workspaceRoot: '/workspace',
    ledgerFile: '/workspace/.decision-os/specs.json',
    cardId: 'card-a',
    cardTitle: 'Card A',
    cardMarkdownFile: '/workspace/.decision-os/cards/specs/card-a.md',
    cardMarkdown: '# Card A\n',
    threadId: 'thread-card-a',
    threadMarkdownFile: '/workspace/.decision-os/threads/specs/thread-card-a.md',
    threadMarkdown: '# OPERATOR\n\nImplement this request.\n',
    runSummaryFile: '/workspace/.decision-os/runs/codex-skills/specs/run.md',
    operatorNoteTimestamp: '2026-07-08T01:00:00.000Z',
  });

  assert.match(prompt.developerInstructions, /^## A\. Scope/m);
  assert.match(prompt.developerInstructions, /^## B\. Scoped Treatment Rules/m);
  assert.match(prompt.developerInstructions, /^## C\. Thread Reply Contract/m);
  assert.match(prompt.developerInstructions, /^## D\. Card Markdown Formatting Rules/m);
  assert.match(prompt.developerInstructions, /\*\*Workspace root:\*\* `\/workspace`/);
  assert.match(prompt.developerInstructions, /\*\*Ledger file:\*\* `\/workspace\/\.decision-os\/specs\.json`/);
  assert.match(prompt.developerInstructions, /\*\*Card id:\*\* `card-a`/);
  assert.match(prompt.developerInstructions, /\*\*Prompt card title at launch:\*\* Card A/);
  assert.match(prompt.developerInstructions, /\*\*Card markdown file:\*\* `\/workspace\/\.decision-os\/cards\/specs\/card-a\.md`/);
  assert.match(prompt.developerInstructions, /\*\*Thread id:\*\* `thread-card-a`/);
  assert.match(prompt.developerInstructions, /\*\*Thread markdown file:\*\* `\/workspace\/\.decision-os\/threads\/specs\/thread-card-a\.md`/);
  assert.match(prompt.developerInstructions, /\*\*Run summary file:\*\* `\/workspace\/\.decision-os\/runs\/codex-skills\/specs\/run\.md`/);
  assert.match(prompt.developerInstructions, /\*\*Operator timestamp:\*\* `2026-07-08T01:00:00\.000Z`/);
  assert.match(prompt.developerInstructions, /ledger-cli validate-master-tasks --ledger \/workspace\/\.decision-os\/specs\.json/);
  assert.doesNotMatch(prompt.developerInstructions, /<(?:workspaceRoot|ledgerFile|cardId|cardTitle|cardMarkdownFile|threadId|threadMarkdownFile|runSummaryFile|operatorNoteTimestamp|epoch-ms|8-hex|ISO-8601)>/);
  assert.doesNotMatch(prompt.developerInstructions, /# Card A|Implement this request/);
  assert.doesNotMatch(prompt.developerInstructions, /treat-open-notes|open notes|You are treating/i);

  assert.match(prompt.taskContext, /Execute the operator request from one decision-os card thread\./);
  assert.match(prompt.taskContext, /Current thread markdown:[\s\S]*Implement this request\./);
  assert.match(prompt.taskContext, /Current card markdown:[\s\S]*# Card A/);
  assert.doesNotMatch(prompt.taskContext, /^## A\. Scope/m);
});
