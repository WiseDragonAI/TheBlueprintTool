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
  });

  assert.match(prompt, /Execute the operator request from one decision-os card thread\./);
  assert.match(prompt, /Thread execution contract:/);
  assert.match(prompt, /Do not inspect or modify unrelated threads\./);
  assert.doesNotMatch(prompt, /treat-open-notes|open notes|Scoped treatment|You are treating/i);
});
