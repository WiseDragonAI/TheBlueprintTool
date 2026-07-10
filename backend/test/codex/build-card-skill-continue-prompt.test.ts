import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardSkillContinuePrompt } from '@backend/business/codex/helper/build-card-skill-continue-prompt.js';

const messages = [{ id: 'note-1', role: 'operator', message: 'Apply the requested change.' }];

test('buildCardSkillContinuePrompt keeps the compact payload for a resumed session', () => {
  const prompt = buildCardSkillContinuePrompt({ messages });

  assert.match(prompt, /^Continue the session with the additional information:/);
  assert.match(prompt, /Apply the requested change\./);
  assert.doesNotMatch(prompt, /previous Codex session is intentionally unavailable/);
});

test('buildCardSkillContinuePrompt reconstructs durable context for a new session', () => {
  const prompt = buildCardSkillContinuePrompt({
    messages,
    newSessionContext: {
      workspaceRoot: '/workspace',
      ledgerFile: '/workspace/.decision-os/specs.json',
      runId: 'codex-skill-1-test',
      cardId: 'card-codex-skill-1-test',
      cardTitle: 'Existing result',
      outputFile: '/workspace/.decision-os/cards/specs/result.md',
      outputMarkdown: '# Existing result\n',
    },
  });

  assert.match(prompt, /^Start a new Codex session for an existing decision-os run\./);
  assert.match(prompt, /The previous Codex session is intentionally unavailable/);
  assert.match(prompt, /Output markdown file: \/workspace\/\.decision-os\/cards\/specs\/result\.md/);
  assert.match(prompt, /# Existing result/);
  assert.match(prompt, /Apply the requested change\./);
});
