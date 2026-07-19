/**
 * WHAT: Renders the normalized status strip for one thread-owned Codex run.
 * WHY: Status presentation is a reusable DOM component independent from log stream replacement.
 */
import { codexRunDurationLabel } from '../../codex/helper/codex-run-duration-label.js';
import { liveCodexRunElapsedMs } from '../../codex/helper/live-codex-run-elapsed-ms.js';
import type { CardSkillRunSummary } from '../../codex/effect/request-card-skill-run-status.js';
import { cardCodexRunPreference } from '../../codex/helper/card-codex-run-preference.js';
import { clearThreadCodexStopState, threadCodexStopState } from '../../codex/controller/stop-thread-codex-run-controller.js';

function renderRunAction(input: { card: Record<string, unknown>; runId: string; threadId: string; running: boolean }): HTMLElement {
  const item = document.createElement('div');
  item.className = 'codex-log-run-action';
  const term = document.createElement('dt');
  term.textContent = 'Action';
  const description = document.createElement('dd');
  const button = document.createElement('button');
  button.type = 'button';
  const occupied = input.running;
  button.className = `codex-log-action-button terminal-button ${occupied ? 'codex-log-stop terminal-button--stop' : 'terminal-button--send'}`;
  button.dataset.action = occupied ? 'stop-thread-codex' : 'process-thread-codex';
  button.dataset.codexRunId = input.runId;
  button.dataset.codexCardId = String(input.card.id ?? '');
  button.dataset.threadId = input.threadId;
  const preference = cardCodexRunPreference(input.card);
  button.dataset.codexModel = preference.model;
  button.dataset.codexEffort = preference.effort;
  const action = input.running ? 'STOP' : input.runId ? 'RESUME' : 'START';
  const readyTitle = `${action[0]}${action.slice(1).toLowerCase()} Codex run`;
  const pendingTitle = 'Stopping Codex run';
  button.title = readyTitle;
  button.setAttribute('aria-label', button.title);
  const icon = document.createElement('span');
  icon.className = 'terminal-button__glyph codex-log-action-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = occupied ? '■' : input.runId ? '↻' : '▶';
  const label = document.createElement('span');
  label.className = 'terminal-button__label';
  if (occupied) {
    label.dataset.codexLogStopLabel = '';
    button.dataset.stopReadyLabel = action;
    button.dataset.stopPendingLabel = 'STOPPING';
    button.dataset.stopReadyTitle = readyTitle;
    button.dataset.stopPendingTitle = pendingTitle;
  }
  label.textContent = action;
  if (occupied && threadCodexStopState(input.runId).pending) {
    button.disabled = true;
    button.dataset.stopPending = 'true';
    button.title = pendingTitle;
    button.setAttribute('aria-label', button.title);
    label.textContent = button.dataset.stopPendingLabel;
  }
  button.replaceChildren(icon, label);
  description.append(button);
  item.append(term, description);
  return item;
}

export function renderThreadCodexLogStatus(input: { summary: CardSkillRunSummary | null; sessionSummary?: CardSkillRunSummary | null; card: Record<string, unknown>; runId: string; threadId: string }): HTMLElement {
  const summary = input.summary;
  const sessionSummary = input.sessionSummary ?? summary;
  const status = !input.runId ? 'idle' : summary?.ok === false ? 'unavailable' : summary?.status ?? 'running';
  const strip = document.createElement('dl');
  strip.className = 'codex-log-status';
  strip.dataset.runStatus = status;
  strip.dataset.runId = input.runId;
  strip.dataset.executionId = summary?.executionId ?? '';
  const running = sessionSummary?.ok === true && sessionSummary.active === true && sessionSummary.status === 'running';
  const queued = sessionSummary?.ok === true && sessionSummary.status === 'pending';
  if (!running) clearThreadCodexStopState(input.runId);
  // Queued work is scheduler-owned. Keep the status surface read-only until it
  // starts so an operator cannot accidentally create, cancel, or delete work.
  if (!queued) strip.append(renderRunAction({ card: input.card, runId: input.runId, threadId: input.threadId, running }));
  const values: Array<[string, string, string?]> = [
    ['Model', summary?.metadata.codexModel || String(input.card.codexRunModel ?? '') || '—'],
    ['Effort', summary?.metadata.codexEffort || String(input.card.codexRunEffort ?? '') || '—'],
    ['Tools', String(summary?.toolCallCount ?? 0)],
  ];
  if (queued) values.splice(0, 0, ['Queue', Number.isInteger(summary.queuePosition) ? `Queued · position ${summary.queuePosition}` : 'Queued']);
  else values.splice(2, 0, ['Elapsed', codexRunDurationLabel(summary ? liveCodexRunElapsedMs(summary) : 0), 'codex-log-elapsed']);
  if (summary?.pipelineRunId) {
    values.splice(1, 0,
      ['Pipeline', `${summary.pipelineName || 'Pipeline'} · ${summary.pipelineStatus || summary.status}`],
      ['Skill', `${summary.skillName || summary.pipelineStepName || 'Skill'} · ${summary.status}`],
    );
  }
  for (const [label, value, dataName] of values) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    // WHAT: Mark only the elapsed value as the targeted live-clock repaint cell.
    // WHY: Clock ticks must not rerender the status strip or event stream.
    if (dataName) description.setAttribute(`data-${dataName}`, '');
    item.append(term, description);
    strip.append(item);
  }
  // WHAT: Add a diagnostics row only when the run reports an operator-relevant fault signal.
  // WHY: Clean runs keep the compact five-column status strip.
  if ((summary?.warningCount ?? 0) > 0 || (summary?.errorCount ?? 0) > 0 || summary?.transportStatus === 'degraded') {
    const diagnostics = document.createElement('div');
    diagnostics.className = 'codex-log-diagnostic-summary';
    const term = document.createElement('dt');
    term.textContent = 'Diagnostics';
    const description = document.createElement('dd');
    description.textContent = [
      summary.warningCount ? `${summary.warningCount} warning${summary.warningCount === 1 ? '' : 's'}` : '',
      summary.errorCount ? `${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}` : '',
      summary.transportStatus === 'degraded' ? 'transport degraded' : '',
    ].filter(Boolean).join(' · ');
    diagnostics.append(term, description);
    strip.append(diagnostics);
  }
  return strip;
}
