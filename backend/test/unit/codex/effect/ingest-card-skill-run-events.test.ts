import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCardSkillRunEventIngestor } from '@backend/business/codex/effect/ingest-card-skill-run-events.js';

test('large partial JSONL records are projected once after their newline arrives', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-ingestor-'));
  const presented: Array<{ events: Array<{ kind: string; text?: string }> }> = [];
  const ingestor = createCardSkillRunEventIngestor({
    decisionOsRoot: root,
    ledgerId: 'tasks',
    ledgerPath: join(root, 'tasks.json'),
    cardId: 'card-a',
    runId: 'run-a',
    executionId: 'execution-a',
    projectId: 'project-a',
    onPresentationEvents: (update) => presented.push(update as typeof presented[number]),
  });
  const line = JSON.stringify({
    type: 'decision_os.user_prompt',
    prompt: 'Selected execution prompt',
    padding: 'x'.repeat(1_200_000),
  }) + '\n';

  for (let offset = 0; offset < line.length; offset += 64 * 1024) {
    ingestor.ingest(line.slice(offset, offset + 64 * 1024));
  }
  ingestor.flush();

  assert.equal(presented.length, 1);
  assert.equal(presented[0].events.length, 1);
  assert.equal(presented[0].events[0].kind, 'run_status');
  assert.equal(presented[0].events[0].text, 'Selected execution prompt');
});
