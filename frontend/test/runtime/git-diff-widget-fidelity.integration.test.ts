import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Git diff card widget uses the shared controls and preserves scoped voice context', () => {
  const widget = source('src/runtime/ledger/component/render-ledger-card-git-diff.ts');
  const recording = source('src/runtime/voice/controller/start-voice-recording.ts');

  assert.match(widget, /createPierreDiffContainer\(pierre\)/);
  assert.match(widget, /terminal-button--send terminal-button--action/);
  assert.doesNotMatch(widget, /git-diff-button/);
  assert.match(widget, /startVoiceRecording\(\{/);
  assert.match(recording, /reviewContext: input\.reviewContext/);
  assert.match(recording, /surfaceRoot: input\.surfaceRoot/);
});
