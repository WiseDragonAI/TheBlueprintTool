/**
 * WHAT: Renders the live status widget for a Codex skill output card.
 * WHY: Operators need progress from the run JSONL while the final card refresh is still pending.
 */
import { state } from '../../state.js';
import { cardCodexRunId } from '../helper/card-codex-run-id.js';
import { codexEffortOptions, codexModelOptions } from '../helper/codex-run-options.js';
import { cardCodexRunPreference } from '../helper/card-codex-run-preference.js';
import { persistCardCodexRunPreference } from '../effect/persist-card-codex-run-preference.js';
import { bindCardSkillRunWidget, bindPipelineStepRunWidget } from '../effect/poll-card-skill-run.js';

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

function selectionMetric(label: string, key: string, options: readonly string[], selectedValue: string): HTMLElement {
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
  if (options.includes(selectedValue)) select.value = selectedValue;
  select.addEventListener('pointerdown', (event) => event.stopPropagation());
  select.addEventListener('click', (event) => event.stopPropagation());
  item.replaceChildren(name, select);
  return item;
}

export function renderCardSkillRunWidget(card: Record<string, unknown>): HTMLElement | null {
  const cardId = String(card.id ?? '');
  const ledgerId = String(state.activeTab ?? '').trim();
  const pipelineRunId = String(card.codexPipelineRunId ?? '').trim();
  const pipelineSkillRunId = String(card.codexRunId ?? '').trim();
  const runId = pipelineRunId && /^codex-skill-[^\s]+$/.test(pipelineSkillRunId)
    ? pipelineSkillRunId
    : cardCodexRunId(card);
  const pipelineStepId = String(card.codexPipelineStepId ?? '').trim();
  if (!cardId || !ledgerId || !runId) return null;

  const widget = document.createElement('section');
  widget.className = 'codex-run-widget';
  widget.dataset.runId = runId;
  widget.dataset.codexCardId = cardId;
  widget.dataset.runStatus = pipelineRunId ? 'pending' : 'running';
  if (pipelineRunId) widget.dataset.pipelineRunId = pipelineRunId;
  if (pipelineStepId) widget.dataset.pipelineStepId = pipelineStepId;
  widget.setAttribute('aria-live', 'polite');

  const body = document.createElement('div');
  body.className = 'codex-run-body';

  const header = document.createElement('div');
  header.className = 'codex-run-header';
  const status = document.createElement('span');
  status.className = 'codex-run-status';
  status.dataset.codexRunStatus = '';
  status.textContent = pipelineRunId ? 'PENDING' : 'RUNNING';
  const context = document.createElement('span');
  context.className = 'codex-run-context';
  context.dataset.codexRunContext = '';
  context.hidden = !pipelineRunId;
  context.textContent = [card.codexPipelineName, card.codexPipelineStepName, card.codexSkillName]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' › ');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'codex-run-stop terminal-button terminal-button--stop';
  cancel.dataset.codexRunCancel = '';
  cancel.title = 'Stop Codex run';
  cancel.setAttribute('aria-label', cancel.title);
  const stopIcon = document.createElement('span');
  stopIcon.className = 'terminal-button__glyph codex-run-stop-icon';
  stopIcon.setAttribute('aria-hidden', 'true');
  stopIcon.textContent = '■';
  const stopLabel = document.createElement('span');
  stopLabel.className = 'terminal-button__label';
  stopLabel.dataset.codexRunStopLabel = '';
  stopLabel.textContent = 'STOP';
  cancel.replaceChildren(stopIcon, stopLabel);
  cancel.hidden = Boolean(pipelineRunId);
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'codex-run-continue terminal-button terminal-button--compact';
  resume.dataset.codexRunContinue = '';
  resume.hidden = true;
  resume.title = 'Continue Codex session';
  resume.setAttribute('aria-label', resume.title);
  resume.textContent = 'Continue';
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'codex-run-restart terminal-button terminal-button--compact';
  restart.dataset.codexRunRestart = '';
  restart.hidden = true;
  restart.title = 'Restart the complete pipeline';
  restart.setAttribute('aria-label', restart.title);
  restart.textContent = 'Restart';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'codex-run-retry terminal-button terminal-button--compact';
  retry.dataset.codexRunRetry = '';
  retry.hidden = true;
  retry.title = 'Retry pipeline status';
  retry.setAttribute('aria-label', retry.title);
  retry.textContent = 'Retry status';
  const actions = document.createElement('div');
  actions.className = 'codex-run-actions';
  actions.replaceChildren(cancel, resume, restart, retry);
  header.replaceChildren(status, context, actions);

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
  const preference = cardCodexRunPreference(card);
  metadata.replaceChildren(
    metric('Source', '', 'codexRunSource'),
    selectionMetric('Model', 'codexRunModel', codexModelOptions, preference.model),
    selectionMetric('Effort', 'codexRunEffort', codexEffortOptions, preference.effort)
  );
  const modelSelect = metadata.querySelector<HTMLSelectElement>('[data-codex-run-model]');
  const effortSelect = metadata.querySelector<HTMLSelectElement>('[data-codex-run-effort]');
  const persistSelection = (): void => {
    void persistCardCodexRunPreference({
      cardId,
      model: modelSelect?.value ?? preference.model,
      effort: effortSelect?.value ?? preference.effort,
    });
  };
  modelSelect?.addEventListener('change', persistSelection);
  effortSelect?.addEventListener('change', persistSelection);

  const latest = document.createElement('p');
  latest.className = 'codex-run-latest';
  latest.dataset.codexRunLatest = '';
  latest.textContent = pipelineRunId ? 'Waiting for an earlier pipeline step' : 'Waiting for output';

  body.replaceChildren(header, metadata, metrics, latest);
  widget.replaceChildren(body, timer);
  if (pipelineRunId) {
    bindPipelineStepRunWidget({ ledgerId, cardId, runId, pipelineRunId, pipelineStepId, element: widget });
  } else {
    bindCardSkillRunWidget({ ledgerId, cardId, runId, element: widget });
  }
  return widget;
}
