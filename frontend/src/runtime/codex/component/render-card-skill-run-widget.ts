/**
 * WHAT: Renders the live status widget for a Codex skill output card.
 * WHY: Operators need progress from the run JSONL while the final card refresh is still pending.
 */
import { state } from '../../state.js';
import { cardCodexRunId } from '../helper/card-codex-run-id.js';
import { bindCardSkillRunWidget } from '../effect/poll-card-skill-run.js';

function metric(label: string, value: string, key: string): HTMLElement {
  const item = document.createElement('span');
  item.className = 'codex-run-metric';
  const name = document.createElement('span');
  name.className = 'codex-run-metric-label';
  name.textContent = label;
  const count = document.createElement('strong');
  count.dataset[key] = '';
  count.textContent = value;
  item.replaceChildren(name, count);
  return item;
}

export function renderCardSkillRunWidget(card: Record<string, unknown>): HTMLElement | null {
  const cardId = String(card.id ?? '');
  const ledgerId = String(state.activeTab ?? '').trim();
  const runId = cardCodexRunId(card);
  if (!cardId || !ledgerId || !runId) return null;

  const widget = document.createElement('section');
  widget.className = 'codex-run-widget';
  widget.dataset.runId = runId;
  widget.dataset.runStatus = 'running';

  const body = document.createElement('div');
  body.className = 'codex-run-body';

  const header = document.createElement('div');
  header.className = 'codex-run-header';
  const status = document.createElement('span');
  status.className = 'codex-run-status';
  status.dataset.codexRunStatus = '';
  status.textContent = 'RUNNING';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'codex-run-cancel terminal-button terminal-button--stop terminal-button--compact';
  cancel.dataset.codexRunCancel = '';
  cancel.title = 'Cancel Codex run';
  cancel.setAttribute('aria-label', cancel.title);
  cancel.textContent = 'Cancel';
  header.replaceChildren(status, cancel);

  const timer = document.createElement('time');
  timer.className = 'codex-run-timer';
  timer.dataset.codexRunTimer = '';
  timer.textContent = '0:00';

  const metrics = document.createElement('div');
  metrics.className = 'codex-run-metrics';
  metrics.replaceChildren(
    metric('Tools', '0', 'codexRunTools'),
    metric('Text', '0', 'codexRunMessages'),
    metric('Files', '0', 'codexRunFiles')
  );

  const latest = document.createElement('p');
  latest.className = 'codex-run-latest';
  latest.dataset.codexRunLatest = '';
  latest.textContent = 'Waiting for output';

  body.replaceChildren(header, metrics, latest);
  widget.replaceChildren(body, timer);
  bindCardSkillRunWidget({ ledgerId, cardId, runId, element: widget });
  return widget;
}
