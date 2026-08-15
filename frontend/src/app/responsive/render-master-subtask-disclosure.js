/**
 * WHAT: Renders the responsive master-task subtask disclosure and synchronizes its accessibility state.
 * WHY: Visible subtask rows must remain mounted while one labelled heading-button-region controls their visibility.
 */

function renderSubtaskRow(document, subtask, onNavigate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'subtask-row';
  button.dataset.cardId = subtask.cardId;
  button.dataset.taskTitle = subtask.title;
  button.dataset.taskStatus = subtask.status;
  const title = document.createElement('span');
  title.textContent = subtask.title;
  const durableStatus = document.createElement('small');
  durableStatus.textContent = subtask.status;
  button.append(title, durableStatus);
  button.addEventListener('click', () => onNavigate(subtask));
  return button;
}

export function renderMasterSubtaskDisclosure({
  document,
  cardIdentity,
  visibleSubtasks,
  expanded,
  onToggle,
  onNavigate,
}) {
  const subtasks = document.createElement('div');
  subtasks.className = 'task-subtasks';
  subtasks.replaceChildren(...visibleSubtasks.map((subtask) => renderSubtaskRow(document, subtask, onNavigate)));

  // WHAT: Preserve the direct heading and empty container used when no visible subtasks exist.
  // WHY: The zero-row master-task path must retain its established layout and navigation boundary.
  if (visibleSubtasks.length === 0) {
    const emptyDisclosure = document.createDocumentFragment();
    const heading = document.createElement('h2');
    heading.textContent = 'Subtasks';
    emptyDisclosure.append(heading, subtasks);
    return emptyDisclosure;
  }

  const stableIdentity = encodeURIComponent(String(cardIdentity));
  const toggleId = `master-subtask-disclosure-toggle-${stableIdentity}`;
  const panelId = `master-subtask-disclosure-panel-${stableIdentity}`;
  const disclosure = document.createElement('section');
  disclosure.className = 'master-subtask-disclosure';
  const heading = document.createElement('h2');
  heading.className = 'master-subtask-disclosure-heading';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'master-subtask-disclosure-toggle';
  toggle.id = toggleId;
  toggle.setAttribute('aria-controls', panelId);
  const label = document.createElement('span');
  label.className = 'master-subtask-disclosure-label';
  label.textContent = 'Subtasks';
  const count = document.createElement('span');
  count.className = 'master-subtask-disclosure-count';
  count.textContent = String(visibleSubtasks.length);
  const chevron = document.createElement('span');
  chevron.className = 'master-subtask-disclosure-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';
  toggle.append(label, count, chevron);
  heading.append(toggle);
  const panel = document.createElement('div');
  panel.className = 'master-subtask-disclosure-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', toggleId);
  const inner = document.createElement('div');
  inner.className = 'master-subtask-disclosure-inner';
  inner.append(subtasks);
  panel.append(inner);
  disclosure.append(heading, panel);

  const sync = (next) => {
    const isExpanded = Boolean(next);
    disclosure.dataset.expanded = String(isExpanded);
    toggle.setAttribute('aria-expanded', String(isExpanded));
    panel.setAttribute('aria-hidden', String(!isExpanded));
    panel.toggleAttribute('inert', !isExpanded);
  };

  toggle.addEventListener('click', () => {
    const next = disclosure.dataset.expanded !== 'true';
    onToggle(next);
    sync(next);
  });
  sync(expanded);
  return disclosure;
}
