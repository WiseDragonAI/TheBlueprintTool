/**
 * WHAT: Renders the focused skill catalog used to insert one skill into a pipeline step.
 * WHY: Step configuration must stay readable instead of embedding the complete skill library beside the skill sequence.
 */
import { pipelineSkillPickerModal } from '../../dom.js';
import { categoryForSkill, colorForSkillCategory, skillCategories, type SkillCategory } from '../helper/skill-category.js';
import type { CodexSkillSummary } from './load-codex-skills.js';
import { openSkillLibraryEditor } from './render-skill-library-editor-modal.js';

export type PipelineSkillPickerSelection = {
  skillName: string;
  insertionIndex: number;
};

type PipelineSkillPickerState = {
  stepId: string;
  stepName: string;
  stepSkillNames: string[];
  skills: CodexSkillSummary[];
  selectedSkillName: string;
  query: string;
  selectedCategory: SkillCategory | 'All';
  insertionIndex: number;
  onInsert?: (selection: PipelineSkillPickerSelection) => void;
  reloadSkills?: () => Promise<readonly CodexSkillSummary[]>;
};

export const pipelineSkillPickerState: PipelineSkillPickerState = {
  stepId: '',
  stepName: '',
  stepSkillNames: [],
  skills: [],
  selectedSkillName: '',
  query: '',
  selectedCategory: 'All',
  insertionIndex: 0,
};

let pickerGeneration = 0;

function makeButton(label: string, onClick: () => void, className = 'ghost-button', focusKey = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  if (focusKey) button.dataset.codexFocusKey = focusKey;
  button.addEventListener('click', onClick);
  return button;
}

function availableCategories(): Array<SkillCategory | 'All'> {
  const available = new Set(pipelineSkillPickerState.skills.map((skill) => categoryForSkill(skill.name)));
  return [
    'All',
    ...skillCategories.filter((category) => available.has(category)),
    ...(available.has('Uncategorized') ? ['Uncategorized' as const] : []),
  ];
}

function filteredSkills(): CodexSkillSummary[] {
  const query = pipelineSkillPickerState.query.trim().toLowerCase();
  return pipelineSkillPickerState.skills.filter((skill) => {
    const category = categoryForSkill(skill.name);
    if (pipelineSkillPickerState.selectedCategory !== 'All' && category !== pipelineSkillPickerState.selectedCategory) return false;
    return !query || `${skill.name} ${skill.description} ${skill.source} ${category}`.toLowerCase().includes(query);
  });
}

function selectedSkill(): CodexSkillSummary | undefined {
  return pipelineSkillPickerState.skills.find((skill) => skill.name === pipelineSkillPickerState.selectedSkillName);
}

function renderSearch(): HTMLInputElement {
  const search = document.createElement('input');
  search.className = 'skill-search pipeline-skill-picker-search';
  search.type = 'search';
  search.placeholder = 'Search skills';
  search.setAttribute('aria-label', 'Search skills');
  search.value = pipelineSkillPickerState.query;
  search.addEventListener('input', () => {
    pipelineSkillPickerState.query = search.value;
    renderPipelineSkillPickerModal();
    pipelineSkillPickerModal?.querySelector<HTMLInputElement>('.pipeline-skill-picker-search')?.focus();
  });
  return search;
}

function renderCategoryFilters(): HTMLElement {
  const filters = document.createElement('div');
  filters.className = 'skill-category-filters pipeline-skill-picker-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filter skills by category');
  for (const category of availableCategories()) {
    const selected = category === pipelineSkillPickerState.selectedCategory;
    const filter = makeButton(category, () => {
      pipelineSkillPickerState.selectedCategory = category;
      renderPipelineSkillPickerModal();
      pipelineSkillPickerModal?.querySelector<HTMLButtonElement>(`[data-picker-category="${category}"]`)?.focus();
    }, `skill-category-filter${selected ? ' is-selected' : ''}`, `picker-category:${category}`);
    filter.dataset.pickerCategory = category;
    filter.style.setProperty('--skill-category-color', colorForSkillCategory(category));
    filter.setAttribute('aria-pressed', String(selected));
    filters.append(filter);
  }
  return filters;
}

function renderSkillResult(skill: CodexSkillSummary): HTMLButtonElement {
  const selected = skill.name === pipelineSkillPickerState.selectedSkillName;
  const category = categoryForSkill(skill.name);
  const result = makeButton('', () => selectPipelineSkillPickerSkill(skill.name), `pipeline-picker-result${selected ? ' is-selected' : ''}`, `picker-skill:${skill.name}`);
  result.style.setProperty('--skill-category-color', colorForSkillCategory(category));
  result.setAttribute('aria-pressed', String(selected));
  const head = document.createElement('span');
  head.className = 'skill-result-header';
  const name = document.createElement('span');
  name.className = 'skill-result-name';
  name.textContent = skill.name;
  const badge = document.createElement('span');
  badge.className = 'skill-result-category';
  badge.textContent = category;
  head.replaceChildren(name, badge);
  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = skill.description || 'No description.';
  const metadata = document.createElement('span');
  metadata.className = 'process-result-metadata';
  metadata.textContent = `${skill.source} · ${skill.effectiveCodexModel} · ${skill.effectiveCodexEffort}`;
  result.replaceChildren(head, description, metadata);
  return result;
}

function renderResults(): HTMLElement {
  const results = document.createElement('section');
  results.className = 'pipeline-picker-results pipeline-skill-picker-results';
  results.setAttribute('aria-label', 'Available skills');
  const matches = filteredSkills();
  if (matches.length > 0) results.replaceChildren(...matches.map(renderSkillResult));
  else {
    const empty = document.createElement('p');
    empty.className = 'codex-empty-state';
    empty.textContent = 'No matching skills.';
    results.append(empty);
  }
  return results;
}

function renderPositionField(): HTMLLabelElement {
  const field = document.createElement('label');
  field.className = 'codex-field compact-field';
  const label = document.createElement('span');
  label.textContent = 'Insert position';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Insert position');
  for (let index = 0; index <= pipelineSkillPickerState.stepSkillNames.length; index += 1) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = index === 0 ? 'At start' : `After ${pipelineSkillPickerState.stepSkillNames[index - 1]}`;
    select.append(option);
  }
  pipelineSkillPickerState.insertionIndex = Math.min(pipelineSkillPickerState.insertionIndex, pipelineSkillPickerState.stepSkillNames.length);
  select.value = String(pipelineSkillPickerState.insertionIndex);
  select.addEventListener('change', () => { pipelineSkillPickerState.insertionIndex = Number(select.value); });
  field.replaceChildren(label, select);
  return field;
}

function editSelectedSkill(): void {
  const skill = selectedSkill();
  if (!skill?.editable) return;
  const generation = pickerGeneration;
  const stepId = pipelineSkillPickerState.stepId;
  void openSkillLibraryEditor({
    skillName: skill.name,
    onSaved: async () => {
      const skills = await pipelineSkillPickerState.reloadSkills?.();
      if (generation !== pickerGeneration || stepId !== pipelineSkillPickerState.stepId || !skills) return;
      pipelineSkillPickerState.skills = [...skills];
      if (!selectedSkill()) pipelineSkillPickerState.selectedSkillName = pipelineSkillPickerState.skills[0]?.name ?? '';
      renderPipelineSkillPickerModal();
    },
  });
}

function renderActions(): HTMLElement {
  const actions = document.createElement('footer');
  actions.className = 'codex-modal-actions pipeline-picker-actions';
  const selected = selectedSkill();
  const selectedName = document.createElement('span');
  selectedName.className = 'skill-selected-name';
  selectedName.textContent = selected?.name ?? 'Choose a skill';
  actions.append(selectedName, renderPositionField());
  if (selected?.editable) actions.append(makeButton('Edit skill', editSelectedSkill, 'ghost-button', 'picker-edit-skill'));
  else if (selected?.readOnlyReason) {
    const reason = document.createElement('span');
    reason.className = 'codex-readonly-reason';
    reason.textContent = selected.readOnlyReason;
    actions.append(reason);
  }
  const add = makeButton('Add skill', confirmPipelineSkillPickerSelection, 'primary-action', 'picker-add-skill');
  add.disabled = !selected;
  actions.append(add, makeButton('Cancel', closePipelineSkillPicker, 'ghost-button', 'picker-cancel'));
  return actions;
}

export function renderPipelineSkillPickerModal(): void {
  if (!pipelineSkillPickerModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Pipeline step';
  const title = document.createElement('h2');
  title.id = 'pipeline-skill-picker-modal-title';
  title.textContent = `Add skill to ${pipelineSkillPickerState.stepName || 'step'}`;
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Select one skill, choose its position, then return to the step configuration.';
  copy.replaceChildren(kicker, title, subtitle);
  const close = makeButton('×', closePipelineSkillPicker, 'plain-close', 'picker-head-close');
  close.setAttribute('aria-label', 'Close skill picker');
  head.replaceChildren(copy, close);
  pipelineSkillPickerModal.replaceChildren(head, renderSearch(), renderCategoryFilters(), renderResults(), renderActions());
  if (focusKey) {
    const nextFocus = pipelineSkillPickerModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
  }
}

export function openPipelineSkillPicker(input: {
  stepId: string;
  stepName: string;
  stepSkillNames: readonly string[];
  skills: readonly CodexSkillSummary[];
  insertionIndex?: number;
  onInsert: (selection: PipelineSkillPickerSelection) => void;
  reloadSkills?: () => Promise<readonly CodexSkillSummary[]>;
}): void {
  pickerGeneration += 1;
  Object.assign(pipelineSkillPickerState, {
    stepId: input.stepId,
    stepName: input.stepName,
    stepSkillNames: [...input.stepSkillNames],
    skills: [...input.skills],
    selectedSkillName: input.skills[0]?.name ?? '',
    query: '',
    selectedCategory: 'All',
    insertionIndex: Math.min(input.insertionIndex ?? input.stepSkillNames.length, input.stepSkillNames.length),
    onInsert: input.onInsert,
    reloadSkills: input.reloadSkills,
  });
  renderPipelineSkillPickerModal();
  if (!pipelineSkillPickerModal?.open) pipelineSkillPickerModal?.showModal?.();
  pipelineSkillPickerModal?.querySelector<HTMLInputElement>('.pipeline-skill-picker-search')?.focus();
}

export function selectPipelineSkillPickerSkill(skillName: string): void {
  if (!pipelineSkillPickerState.skills.some((skill) => skill.name === skillName)) return;
  pipelineSkillPickerState.selectedSkillName = skillName;
  renderPipelineSkillPickerModal();
  pipelineSkillPickerModal?.querySelector<HTMLButtonElement>(`[data-codex-focus-key="picker-skill:${skillName}"]`)?.focus();
}

export function confirmPipelineSkillPickerSelection(): void {
  const skillName = pipelineSkillPickerState.selectedSkillName;
  if (!skillName) return;
  const onInsert = pipelineSkillPickerState.onInsert;
  const insertionIndex = pipelineSkillPickerState.insertionIndex;
  closePipelineSkillPicker();
  onInsert?.({ skillName, insertionIndex });
}

export function closePipelineSkillPicker(): void {
  pickerGeneration += 1;
  pipelineSkillPickerModal?.close?.();
}
