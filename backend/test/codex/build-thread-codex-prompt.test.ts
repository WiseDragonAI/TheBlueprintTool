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
    context: { version: 2, card: { id: 'card-a', markdown: '# Card A\n' }, thread: { id: 'thread-card-a', markdown: '# OPERATOR\n\nImplement this request.\n' } },
  });

  assert.match(prompt.developerInstructions, /^Decision OS card run:/);
  assert.doesNotMatch(prompt.developerInstructions, /session-context/);
  assert.match(prompt.developerInstructions, /master-task-apply/);
  assert.match(prompt.developerInstructions, /master-task-gate[^\n]+card-a/);
  assert.match(prompt.developerInstructions, /--thread-id thread-card-a --message-stdin/);
  assert.match(prompt.developerInstructions, /workspace `AGENTS\.md` formatting contract/);
  assert.ok(prompt.developerInstructions.length < 700);
  assert.doesNotMatch(prompt.developerInstructions, /card-context|do not|never|locate the CLI/i);
  assert.doesNotMatch(prompt.developerInstructions, /Scope|Contract|Acceptance Criteria/);
  assert.doesNotMatch(prompt.developerInstructions, /# Card A|Implement this request/);
  assert.doesNotMatch(prompt.developerInstructions, /treat-open-notes|open notes|You are treating/i);

  assert.match(prompt.taskContext, /Execute the operator request from this Decision OS thread\./);
  assert.match(prompt.taskContext, /Decision OS context:/);
  assert.match(prompt.taskContext, /Implement this request\./);
  assert.match(prompt.taskContext, /# Card A/);
  assert.doesNotMatch(prompt.taskContext, /^## [A-Z]\./m);
});
