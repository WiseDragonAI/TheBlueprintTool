/**
 * WHAT: Locks the active Codex run stop-control rendering and state contract.
 * WHY: Operators must get a prominent stop action whose UI state matches the existing process cancellation request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('Codex run widget renders a large square STOP control instead of compact Cancel', () => {
  const widget = source('frontend/src/runtime/codex/component/render-card-skill-run-widget.ts');
  const styles = source('frontend/assets/canvas/objects.css');

  assert.match(widget, /cancel\.className = 'codex-run-stop terminal-button terminal-button--stop'/);
  assert.doesNotMatch(widget, /codex-run-stop[^'\n]*terminal-button--compact/);
  assert.match(widget, /stopIcon\.textContent = '■'/);
  assert.match(widget, /stopLabel\.textContent = 'STOP'/);
  assert.match(widget, /cancel\.title = 'Stop Codex run'/);
  assert.match(styles, /\.codex-run-stop\s*{[^}]*width:\s*58px;[^}]*height:\s*58px;[^}]*grid-template-rows:\s*28px 16px;/s);
});

test('Codex run STOP state preserves one guarded request and rejected-request recovery', () => {
  const poller = source('frontend/src/runtime/codex/effect/poll-card-skill-run.ts');

  assert.match(poller, /if \(!poller\.element \|\| poller\.terminal \|\| poller\.cancelInFlight\) return;/);
  assert.match(poller, /poller\.cancelInFlight = true;[\s\S]*setCancelButtonState\(button, 'stopping', poller\.element\.dataset\.runStatus\);[\s\S]*requestCardSkillRunCancel/);
  assert.match(poller, /const text = pending \? \(stopping \? 'CANCELLING' : 'CANCEL'\) : \(stopping \? 'STOPPING' : 'STOP'\)/);
  assert.match(poller, /setText\(poller\.element, '\[data-codex-run-latest\]', 'Stopping run'\)/);
  assert.match(poller, /if \(!result\.ok\) \{[\s\S]*setCancelButtonState\(button, 'ready', poller\.element\.dataset\.runStatus\);[\s\S]*result\.error \|\| 'Stop failed'/);
  assert.match(poller, /schedulePoll\(poller, 0\)/);
  assert.match(poller, /summary\.status === 'running'[\s\S]*setCancelButtonVisible\(element, true\)/);
  assert.match(poller, /setCancelButtonVisible\(element, false\)/);
});
