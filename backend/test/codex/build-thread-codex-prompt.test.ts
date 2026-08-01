import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreadCodexPrompt } from '@backend/business/codex/helper/build-thread-codex-prompt.js';
import { compilePipelinePromptGraph } from '@backend/business/codex/helper/pipeline-prompt-library.js';
import { testCodexRunPrompt } from '../support/pipeline-prompt-fixture.js';

const developerPromptSnapshot = compilePipelinePromptGraph({
  roots: ['CODEX_RUN'],
  resolve: (name) => name === 'SYSTEM_PROMPT'
    ? 'platform: <PLATFORM>'
    : name === 'CODEX_RUN'
      ? testCodexRunPrompt
      : null,
}).developerPromptSnapshot;

test('thread Codex prompt uses a direct scoped contract without triggering open-note skills', () => {
  const prompt = buildThreadCodexPrompt({
    developerPromptSnapshot,
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

  assert.match(prompt.developerInstructions, /^platform: linux\n\nDecision OS card run:/);
  assert.match(prompt.developerInstructions, /Project: `project-a`\./);
  assert.doesNotMatch(prompt.developerInstructions, /session-context/);
  assert.match(prompt.developerInstructions, /master-task-apply/);
  assert.match(prompt.developerInstructions, /master-task-progress --plan-stdin --json/);
  assert.match(prompt.developerInstructions, /replicated lifecycle and positioned `subtask` relationships are authoritative/);
  assert.match(prompt.developerInstructions, /living strategic summary for a CTO/);
  assert.match(prompt.developerInstructions, /never as a run log, implementation inventory, or verification report/);
  assert.match(prompt.developerInstructions, /replace the complete body with the current strategic state/);
  assert.match(prompt.developerInstructions, /Use letter-prefixed H2 sections, --- between sections, numbered list items\./);
  assert.match(prompt.developerInstructions, /one credible path and why it advances the objective/);
  assert.doesNotMatch(prompt.developerInstructions, /bold inside sentences|backticks/);
  assert.match(prompt.developerInstructions, /never expose raw UUIDs, run IDs, card IDs, thread IDs, relationship IDs, hashes, encoded project IDs, or timestamps/);
  assert.match(prompt.developerInstructions, /Omit test counts, routine verification results, file inventories, commits, pushes, process narration, and implementation chronology/);
  assert.match(prompt.developerInstructions, /global context and objective; verified current state; strategic constraints and choices; current decision or blocker/);
  assert.match(prompt.developerInstructions, /Keep relationship membership and lifecycle state out of Markdown/);
  assert.match(prompt.developerInstructions, /Master-task rendered-output gate/);
  assert.match(prompt.developerInstructions, /inspect the complete rendered summary/);
  assert.match(prompt.developerInstructions, /Do not submit a partially compliant summary/);
  assert.match(prompt.developerInstructions, /thread reply is a separate CTO-facing iteration record/);
  assert.match(prompt.developerInstructions, /very short numbered bullets with no heading or section/);
  assert.match(prompt.developerInstructions, /material outcomes from this iteration/);
  assert.match(prompt.developerInstructions, /Never include raw UUIDs or other opaque internal identifiers/);
  assert.match(prompt.developerInstructions, /name the human-readable subject and outcome instead/);
  assert.match(prompt.developerInstructions, /Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions/);
  assert.match(prompt.developerInstructions, /Put all reasoning and complete task state in the master-task body/);
  assert.doesNotMatch(prompt.developerInstructions, /master-task-complete/);
  assert.match(prompt.developerInstructions, /Never close or mark the master task done from a normal card run/);
  assert.match(prompt.developerInstructions, /direct operator action or an explicitly invoked closeout skill/);
  assert.match(prompt.developerInstructions, /master-task-gate[^\n]+card-a/);
  assert.match(prompt.developerInstructions, /--thread-id thread-card-a --message-stdin/);
  assert.match(prompt.developerInstructions, /workspace `AGENTS\.md` Markdown contract/);
  assert.ok(prompt.developerInstructions.length < 4_500);
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
    developerPromptSnapshot,
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
