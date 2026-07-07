/**
 * WHAT: Renders and updates the card Codex skill picker modal.
 * WHY: Operators need searchable skill descriptions before launching a card-scoped process.
 */
import { skillModal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { processCardSkillController } from '../controller/process-card-skill-controller.js';
import { loadCodexSkills, type CodexSkillSummary } from './load-codex-skills.js';

type SkillModalState = {
  cardId: string;
  query: string;
  selectedSkillName: string;
  codexModel: string;
  codexEffort: string;
  skills: CodexSkillSummary[];
  loading: boolean;
  processing: boolean;
  error: string;
};

type RenderSkillModalOptions = {
  resultsScrollTop?: number;
};

const skillModalState: SkillModalState = {
  cardId: '',
  query: '',
  selectedSkillName: '',
  codexModel: 'gpt-5.5',
  codexEffort: 'high',
  skills: [],
  loading: false,
  processing: false,
  error: '',
};

const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'];

function renderSelect(input: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'skill-run-field';
  const labelText = document.createElement('span');
  labelText.textContent = input.label;
  const select = document.createElement('select');
  select.setAttribute('aria-label', input.label);
  for (const optionValue of input.options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  }
  select.value = input.options.includes(input.value) ? input.value : input.options[0] ?? '';
  select.addEventListener('change', () => input.onChange(select.value));
  label.replaceChildren(labelText, select);
  return label;
}

function filteredSkills(): CodexSkillSummary[] {
  const query = skillModalState.query.trim().toLowerCase();
  if (!query) return skillModalState.skills;
  return skillModalState.skills.filter((skill) => {
    const text = `${skill.name} ${skill.description} ${skill.source}`.toLowerCase();
    return text.includes(query);
  });
}

function renderSkillRow(skill: CodexSkillSummary): HTMLButtonElement {
  const selected = skill.name === skillModalState.selectedSkillName;
  const button = document.createElement('button');
  button.className = `skill-result${selected ? ' is-selected' : ''}`;
  button.type = 'button';
  button.dataset.action = 'select-card-skill';
  button.dataset.skillName = skill.name;
  button.setAttribute('aria-pressed', String(selected));

  const title = document.createElement('span');
  title.className = 'skill-result-name';
  title.textContent = skill.name;
  const source = document.createElement('span');
  source.className = 'skill-result-source';
  source.textContent = skill.source;
  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = skill.description || 'No description.';
  button.replaceChildren(title, source, description);
  return button;
}

function renderSkillModal(options: RenderSkillModalOptions = {}): void {
  if (!skillModal) return;
  const title = document.createElement('h2');
  title.id = 'skill-modal-title';
  title.textContent = 'Codex Skills';

  const search = document.createElement('input');
  search.className = 'skill-search';
  search.type = 'search';
  search.placeholder = 'Search skills';
  search.value = skillModalState.query;
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search skills');
  search.addEventListener('input', () => {
    skillModalState.query = search.value;
    renderSkillModal();
    skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
  });

  const runControls = document.createElement('div');
  runControls.className = 'skill-run-controls';
  const modelSelect = renderSelect({
    label: 'Model',
    value: skillModalState.codexModel,
    options: codexModelOptions,
    onChange: (value) => {
      skillModalState.codexModel = value;
      telemetry('codex-skill-model-selected', { cardId: skillModalState.cardId, codexModel: value });
    },
  });
  const effortSelect = renderSelect({
    label: 'Effort',
    value: skillModalState.codexEffort,
    options: codexEffortOptions,
    onChange: (value) => {
      skillModalState.codexEffort = value;
      telemetry('codex-skill-effort-selected', { cardId: skillModalState.cardId, codexEffort: value });
    },
  });
  runControls.replaceChildren(modelSelect, effortSelect);

  const results = document.createElement('div');
  results.className = 'skill-results';
  if (skillModalState.loading) {
    const loading = document.createElement('p');
    loading.className = 'skill-empty';
    loading.textContent = 'Loading skills';
    results.replaceChildren(loading);
  } else {
    const rows = filteredSkills().map(renderSkillRow);
    if (rows.length > 0) results.replaceChildren(...rows);
    else {
      const empty = document.createElement('p');
      empty.className = 'skill-empty';
      empty.textContent = 'No matching skills';
      results.replaceChildren(empty);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'skill-actions';
  if (skillModalState.error) {
    const error = document.createElement('p');
    error.className = 'skill-error';
    error.textContent = skillModalState.error;
    actions.append(error);
  }
  if (skillModalState.selectedSkillName) {
    const selectedName = document.createElement('span');
    selectedName.className = 'skill-selected-name';
    selectedName.title = skillModalState.selectedSkillName;
    selectedName.textContent = skillModalState.selectedSkillName;
    actions.append(selectedName);

    const process = document.createElement('button');
    process.className = 'skill-process-button';
    process.type = 'button';
    process.dataset.action = 'process-card-skill';
    process.disabled = skillModalState.processing;
    process.textContent = skillModalState.processing ? 'Processing' : 'Process';
    actions.append(process);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.dataset.action = 'close-card-skill-modal';
  close.textContent = 'Close';
  actions.append(close);

  skillModal.setAttribute('aria-labelledby', 'skill-modal-title');
  skillModal.replaceChildren(title, search, runControls, results, actions);
  if (options.resultsScrollTop !== undefined) results.scrollTop = options.resultsScrollTop;
}

export async function openCardSkillModal(cardId: string): Promise<void> {
  if (!skillModal || !cardId) return;
  Object.assign(skillModalState, { cardId, query: '', selectedSkillName: '', skills: [], loading: true, processing: false, error: '' });
  renderSkillModal();
  skillModal.showModal?.();
  telemetry('codex-skill-modal-open', { cardId });
  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
  skillModalState.skills = await loadCodexSkills();
  skillModalState.loading = false;
  renderSkillModal();
  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
}

export function selectCardSkill(skillName: string): void {
  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
  skillModalState.selectedSkillName = skillName;
  skillModalState.error = '';
  renderSkillModal({ resultsScrollTop });
  telemetry('codex-skill-selected', { cardId: skillModalState.cardId, skillName });
}

export async function processSelectedCardSkill(): Promise<void> {
  if (!skillModalState.cardId || !skillModalState.selectedSkillName || skillModalState.processing) return;
  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
  skillModalState.processing = true;
  skillModalState.error = '';
  renderSkillModal({ resultsScrollTop });
  const ok = await processCardSkillController({
    cardId: skillModalState.cardId,
    skillName: skillModalState.selectedSkillName,
    codexModel: skillModalState.codexModel,
    codexEffort: skillModalState.codexEffort,
  });
  skillModalState.processing = false;
  if (ok) {
    skillModal?.close?.();
    return;
  }
  skillModalState.error = 'Process failed';
  renderSkillModal({ resultsScrollTop });
}

export function closeCardSkillModal(): void {
  skillModal?.close?.();
}
