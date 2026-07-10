/**
 * WHAT: Renders the live status widget for a Codex skill output card.
 * WHY: Operators need progress from the run JSONL while the final card refresh is still pending.
 */
import { state } from '../../state.js';
import { cardCodexRunId } from '../helper/card-codex-run-id.js';
import { codexEffortOptions, codexModelOptions } from '../helper/codex-run-options.js';
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

function selectionMetric(label: string, key: string, options: readonly string[]): HTMLElement {
  const item = document.createElement('label');
  item.className = 'codex-run-metric codex-run-metric--control';
  const name = document.createElement('span');
  name.className = 'codex-run-metric-label';
  name.textContent = label;
  const select = document.createElement('select');
  select.className = 'codex-run-select';
  select.dataset[key] = '';
  select.disabled = true;
  select.setAttribute('aria-label', `${label} for next Codex turn`);
  for (const value of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.addEventListener('pointerdown', (event) => event.stopPropagation());
  select.addEventListener('click', (event) => event.stopPropagation());
  item.replaceChildren(name, select);
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
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'codex-run-continue terminal-button terminal-button--compact';
  resume.dataset.codexRunContinue = '';
  resume.hidden = true;
  resume.title = 'Continue Codex session';
  resume.setAttribute('aria-label', resume.title);
  resume.textContent = 'Continue';
  const newSession = document.createElement('button');
  newSession.type = 'button';
  newSession.className = 'codex-run-new-session terminal-button terminal-button--compact';
  newSession.dataset.codexRunNewSession = '';
  newSession.hidden = true;
  newSession.title = 'Start a new Codex session';
  newSession.setAttribute('aria-label', newSession.title);
  newSession.textContent = 'New session';
  const actions = document.createElement('div');
  actions.className = 'codex-run-actions';
  actions.replaceChildren(cancel, resume, newSession);
  header.replaceChildren(status, actions);

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

  const metadata = document.createElement('div');
  metadata.className = 'codex-run-metadata';
  metadata.dataset.codexRunMetadata = '';
  metadata.hidden = true;
  metadata.replaceChildren(
    metric('Source', '', 'codexRunSource'),
    selectionMetric('Model', 'codexRunModel', codexModelOptions),
    selectionMetric('Effort', 'codexRunEffort', codexEffortOptions)
  );

  const latest = document.createElement('p');
  latest.className = 'codex-run-latest';
  latest.dataset.codexRunLatest = '';
  latest.textContent = 'Waiting for output';

  body.replaceChildren(header, metadata, metrics, latest);
  widget.replaceChildren(body, timer);
  bindCardSkillRunWidget({ ledgerId, cardId, runId, element: widget });
  return widget;
}
