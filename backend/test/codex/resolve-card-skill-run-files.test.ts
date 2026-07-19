import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { resolveCardSkillRunFiles } from '@backend/business/codex/helper/resolve-card-skill-run-files.js';

test('run files follow persisted ownership after a card moves to another ledger', () => {
  const decisionOsRoot = join('/workspace', '.decision-os');
  const runId = 'codex-skill-1234-abcd';
  const files = resolveCardSkillRunFiles({
    decisionOsRoot,
    ledgerPath: join(decisionOsRoot, 'tasks.json'),
    cardId: 'card-a',
    runId,
    ledger: {
      cards: [{
        id: 'card-a',
        codexThreadRunId: runId,
        codexThreadRunOutputFile: `.decision-os/runs/codex-skills/specs/${runId}.md`,
      }],
    },
  });

  assert.equal(files.runDirectory, join(decisionOsRoot, 'runs', 'codex-skills', 'specs'));
  assert.equal(files.outputFile, join(decisionOsRoot, 'runs', 'codex-skills', 'specs', `${runId}.md`));
  assert.equal(files.stdoutFile, join(decisionOsRoot, 'runs', 'codex-skills', 'specs', `${runId}.jsonl`));
  assert.equal(files.stderrFile, join(decisionOsRoot, 'runs', 'codex-skills', 'specs', `${runId}.log`));
});

test('run files reject persisted paths outside the Codex run root', () => {
  const decisionOsRoot = join('/workspace', '.decision-os');
  const runId = 'codex-skill-1234-abcd';
  const files = resolveCardSkillRunFiles({
    decisionOsRoot,
    ledgerPath: join(decisionOsRoot, 'tasks.json'),
    cardId: 'card-a',
    runId,
    ledger: {
      cards: [{
        id: 'card-a',
        codexThreadRunOutputFile: '.decision-os/cards/specs/card-a.md',
      }],
    },
  });

  assert.equal(files.runDirectory, join(decisionOsRoot, 'runs', 'codex-skills', 'tasks'));
});
