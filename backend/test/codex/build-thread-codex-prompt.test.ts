import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreadCodexPrompt } from '@backend/business/codex/helper/build-thread-codex-prompt.js';

test('thread Codex prompt uses a direct scoped contract without triggering open-note skills', () => {
  const prompt = buildThreadCodexPrompt({
    workspaceRoot: '/workspace',
    projectId: 'project-a',
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
    context: { version: 2, card: { id: 'card-a', markdown: '# Card A\n' }, thread: { id: 'thread-card-a', markdown: '# OPERATOR\n\nImplement this request.\n' }, actions: { executionProfile: { command: 'ledger-cli execution-profile --ledger "$DECISION_OS_LEDGER_FILE" --json' } } },
  });

  assert.match(prompt.developerInstructions, /^Decision OS card run:/);
  assert.match(prompt.developerInstructions, /Project: `project-a`\./);
  assert.doesNotMatch(prompt.developerInstructions, /session-context/);
  assert.match(prompt.developerInstructions, /master-task-apply/);
  assert.match(prompt.developerInstructions, /master-task-progress --plan-stdin --json/);
  assert.match(prompt.developerInstructions, /JSON status and `subtask` relationships are authoritative/);
  assert.match(prompt.developerInstructions, /living strategic summary for a CTO/);
  assert.match(prompt.developerInstructions, /global context, objective, verified state, strategic constraints, choices, blocker or decision, credible path, expected outcome, and open operator questions/);
  assert.match(prompt.developerInstructions, /why the chosen direction advances the objective/);
  assert.match(prompt.developerInstructions, /\*\*bold inside sentences\*\*/);
  assert.match(prompt.developerInstructions, /never as a list-item label/);
  assert.match(prompt.developerInstructions, /`backticks` only for supporting mechanisms, system states, and dependencies/);
  assert.match(prompt.developerInstructions, /Omit routine implementation detail unless the strategic decision cannot be understood without it/);
  assert.match(prompt.developerInstructions, /canonical links under the letter-prefixed `Subtasks` section/);
  assert.match(prompt.developerInstructions, /thread reply is a separate CTO-facing iteration record/);
  assert.match(prompt.developerInstructions, /very short numbered bullets with no heading or section/);
  assert.match(prompt.developerInstructions, /material outcomes from this iteration/);
  assert.match(prompt.developerInstructions, /Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions/);
  assert.match(prompt.developerInstructions, /Put all reasoning and complete task state in the master-task body/);
  assert.doesNotMatch(prompt.developerInstructions, /master-task-complete/);
  assert.match(prompt.developerInstructions, /Never close or mark the master task done from a normal card run/);
  assert.match(prompt.developerInstructions, /direct operator action or an explicitly invoked closeout skill/);
  assert.match(prompt.developerInstructions, /master-task-gate[^\n]+card-a/);
  assert.match(prompt.developerInstructions, /--thread-id thread-card-a --message-stdin/);
  assert.match(prompt.developerInstructions, /workspace `AGENTS\.md` Markdown contract/);
  assert.ok(prompt.developerInstructions.length < 2_500);
  assert.doesNotMatch(prompt.developerInstructions, /card-context|locate the CLI/i);
  assert.doesNotMatch(prompt.developerInstructions, /Scope|Contract|Acceptance Criteria/);
  assert.doesNotMatch(prompt.developerInstructions, /# Card A|Implement this request/);
  assert.doesNotMatch(prompt.developerInstructions, /treat-open-notes|open notes|You are treating/i);

  assert.match(prompt.taskContext, /Execute the operator request from this Decision OS thread\./);
  assert.match(prompt.taskContext, /Decision OS context:/);
  assert.match(prompt.taskContext, /ledger-cli execution-profile/);
  assert.match(prompt.taskContext, /Implement this request\./);
  assert.match(prompt.taskContext, /# Card A/);
  assert.doesNotMatch(prompt.taskContext, /^## [A-Z]\./m);
});

test('voice Run prompt explicitly disallows skills', () => {
  const prompt = buildThreadCodexPrompt({
    workspaceRoot: '/workspace',
    projectId: 'project-a',
    ledgerFile: '/workspace/.decision-os/specs.json',
    cardId: 'card-a',
    cardTitle: 'Card A',
    cardMarkdownFile: '/workspace/.decision-os/cards/specs/card-a.md',
    cardMarkdown: '# Card A\n',
    threadId: 'thread-card-a',
    threadMarkdownFile: '/workspace/.decision-os/threads/specs/thread-card-a.md',
    threadMarkdown: '# OPERATOR\n\nRun directly.\n',
    runSummaryFile: '/workspace/.decision-os/runs/codex-skills/specs/run.md',
    operatorNoteTimestamp: '2026-07-08T01:00:00.000Z',
    context: {},
    disallowSkills: true,
  });
  assert.match(prompt.developerInstructions, /Do not invoke or use any skill for this run/);
});
