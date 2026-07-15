import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardLaunchContext } from '@backend/business/codex/helper/build-card-launch-context.js';

test('card launch context exposes the execution profile action', () => {
  const context = buildCardLaunchContext({
    projectId: 'project-a',
    ledgerId: 'specs',
    cardId: 'card-a',
    threadId: 'thread-card-a',
    ledger: {
      cards: [{ id: 'card-a', title: 'Card A', status: 'todo', domainId: 'specs', cardType: 'note' }],
      relationships: [],
      annotations: [],
    },
    cardMarkdown: '# Card A\n',
    threadMarkdown: '# OPERATOR\n\nImplement this request.\n',
  });

  const actions = context.actions as Record<string, { command: string }>;
  assert.equal(actions.executionProfile.command, 'ledger-cli execution-profile --ledger "$DECISION_OS_LEDGER_FILE" --json');
  assert.match(actions.masterTaskApply.command, /ledger-cli master-task-apply/);
});
