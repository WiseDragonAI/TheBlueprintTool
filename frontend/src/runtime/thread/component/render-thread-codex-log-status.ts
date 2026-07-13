/**
 * WHAT: Renders the normalized status strip for one thread-owned Codex run.
 * WHY: Status presentation is a reusable DOM component independent from log stream replacement.
 */
import { codexRunDurationLabel } from '../../codex/helper/codex-run-duration-label.js';
import { liveCodexRunElapsedMs } from '../../codex/helper/live-codex-run-elapsed-ms.js';
import type { CardSkillRunSummary } from '../../codex/effect/request-card-skill-run-status.js';

export function renderThreadCodexLogStatus(input: { summary: CardSkillRunSummary | null; card: Record<string, unknown>; runId: string; threadId: string }): HTMLElement {
  const summary = input.summary;
  const status = summary?.ok === false ? 'unavailable' : summary?.status ?? 'running';
  const strip = document.createElement('dl');
  strip.className = 'codex-log-status';
  strip.dataset.runStatus = status;
  strip.dataset.runId = input.runId;
  const terminal = status === 'complete' || status === 'failed' || status === 'cancelled';
  if (status === 'running' || terminal) {
    const action = document.createElement('div');
    action.className = 'codex-log-run-action';
    const term = document.createElement('dt');
    term.textContent = 'Run action';
    const description = document.createElement('dd');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.codexRunId = input.runId;
    button.dataset.codexCardId = String(input.card.id ?? '');
    const icon = document.createElement('span');
    icon.className = 'terminal-button__glyph codex-log-run-action-icon';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'terminal-button__label';
    if (status === 'running') {
      button.className = 'codex-log-stop terminal-button terminal-button--stop';
      button.dataset.action = 'stop-thread-codex';
      button.title = 'Stop Codex run';
      icon.textContent = '■';
      label.dataset.codexLogStopLabel = '';
      label.textContent = 'STOP';
    } else {
      button.className = 'codex-log-resume terminal-button terminal-button--send';
      button.dataset.action = 'process-thread-codex';
      button.dataset.threadId = input.threadId;
      button.dataset.codexModel = summary?.metadata.codexModel || String(input.card.codexRunModel ?? '');
      button.dataset.codexEffort = summary?.metadata.codexEffort || String(input.card.codexRunEffort ?? '');
      button.title = 'Resume Codex run';
      icon.textContent = '▶';
      label.textContent = 'RESUME';
    }
    button.setAttribute('aria-label', button.title);
    button.replaceChildren(icon, label);
    description.append(button);
    action.append(term, description);
    strip.append(action);
  }
  const values: Array<[string, string, string?]> = [
    ['Model', summary?.metadata.codexModel || String(input.card.codexRunModel ?? '') || '—'],
    ['Effort', summary?.metadata.codexEffort || String(input.card.codexRunEffort ?? '') || '—'],
    ['Elapsed', codexRunDurationLabel(summary ? liveCodexRunElapsedMs(summary) : 0), 'codex-log-elapsed'],
    ['Tools', String(summary?.toolCallCount ?? 0)],
  ];
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
