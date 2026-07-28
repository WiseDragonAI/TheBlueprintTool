/**
 * WHAT: Renders the focused skill catalog used to insert one skill into a pipeline step.
 * WHY: Step configuration must stay readable instead of embedding the complete skill library beside the skill sequence.
 */
import { pipelineSkillPickerModal } from '../../dom.js';
import { renderCodexLibrary } from '../component/render-codex-library.js';
import { renderSkillLibraryItemContent } from '../component/render-skill-library-item-content.js';
import { colorForSkillTag, tagsForSkill } from '../helper/skill-library-presentation.js';
import type { CodexPipelineContentSummary } from './load-codex-pipelines.js';
import { openSkillLibraryCreator, openSkillLibraryEditor } from './render-skill-library-editor-modal.js';

export type PipelineSkillPickerSelection = {
  skillName: string;
  contentKind: CodexPipelineContentSummary['contentKind'];
  insertionIndex: number;
};

type PipelineSkillPickerState = {
  stepId: string;
  stepName: string;
  stepSkillNames: string[];
  skills: CodexPipelineContentSummary[];
  selectedSkillName: string;
  query: string;
  selectedCategory: string;
  insertionIndex: number;
  requestProjectId: string;
  onInsert?: (selection: PipelineSkillPickerSelection) => void;
  reloadSkills?: () => Promise<readonly CodexPipelineContentSummary[]>;
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
  requestProjectId: '',
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

function selectedSkill(): CodexPipelineContentSummary | undefined {
  return pipelineSkillPickerState.skills.find((skill) => skill.name === pipelineSkillPickerState.selectedSkillName);
}

function renderSkillResult(skill: CodexPipelineContentSummary): HTMLButtonElement {
  const selected = skill.name === pipelineSkillPickerState.selectedSkillName;
  const category = tagsForSkill(skill)[0];
  const result = makeButton('', () => selectPipelineSkillPickerSkill(skill.name), `pipeline-picker-result${selected ? ' is-selected' : ''}`, `picker-skill:${skill.name}`);
  result.style.setProperty('--skill-category-color', colorForSkillTag(category));
  result.setAttribute('aria-pressed', String(selected));
  const metadata = document.createElement('span');
  metadata.className = 'process-result-metadata';
  metadata.textContent = `${skill.effectiveCodexModel} · ${skill.effectiveCodexEffort}`;
  result.replaceChildren(...renderSkillLibraryItemContent(skill), metadata);
  return result;
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
  // WHAT: Terminate editor-open failures at the picker event boundary.
  // WHY: A detached modal request must not create an unhandled browser rejection.
  void openSkillLibraryEditor({
    skillName: skill.name,
    requestProjectId: pipelineSkillPickerState.requestProjectId,
    onSaved: async () => {
      const skills = await pipelineSkillPickerState.reloadSkills?.();
      if (generation !== pickerGeneration || stepId !== pipelineSkillPickerState.stepId || !skills) return;
      pipelineSkillPickerState.skills = [...skills];
      if (!selectedSkill()) pipelineSkillPickerState.selectedSkillName = pipelineSkillPickerState.skills[0]?.name ?? '';
      renderPipelineSkillPickerModal();
    },
  }).catch((error: unknown) => {
    console.error('Pipeline skill editor could not open.', error);
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
  const createPrompt = makeButton('Create pipeline prompt', () => {
    const generation = pickerGeneration;
    const stepId = pipelineSkillPickerState.stepId;
    openSkillLibraryCreator({
      contentKind: 'pipeline-prompt',
      requestProjectId: pipelineSkillPickerState.requestProjectId,
      onSaved: async (created) => {
        const skills = await pipelineSkillPickerState.reloadSkills?.();
        if (generation !== pickerGeneration || stepId !== pipelineSkillPickerState.stepId || !skills) return;
        pipelineSkillPickerState.skills = [...skills];
        pipelineSkillPickerState.selectedSkillName = created.name;
        renderPipelineSkillPickerModal();
      },
    });
  }, 'ghost-button', 'picker-create-prompt');
  createPrompt.disabled = !pipelineSkillPickerState.requestProjectId;
  if (createPrompt.disabled) createPrompt.title = 'Select a project context before creating authored content.';
  actions.append(createPrompt);
  if (selected?.editable) {
    const edit = makeButton('Edit skill', editSelectedSkill, 'ghost-button', 'picker-edit-skill');
    edit.disabled = !pipelineSkillPickerState.requestProjectId;
    if (edit.disabled) edit.title = 'Select a project context before editing authored content.';
    actions.append(edit);
  }
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
  const controls = document.createElement('div');
  controls.className = 'codex-library-controls pipeline-skill-picker-controls';
  const results = document.createElement('section');
  results.className = 'pipeline-picker-results pipeline-skill-picker-results';
  renderCodexLibrary({
    records: pipelineSkillPickerState.skills.map((skill) => ({ ...skill, id: skill.name, tags: tagsForSkill(skill) })),
    projects: [],
    filters: { query: pipelineSkillPickerState.query, projectId: 'All', tag: pipelineSkillPickerState.selectedCategory },
    controlsHost: controls,
    resultsHost: results,
    selectedId: pipelineSkillPickerState.selectedSkillName,
    favoriteFirst: true,
    emptyMessage: 'No matching skills.',
    resultCountLabel: 'available skills',
    onFiltersChanged: (filters) => {
      pipelineSkillPickerState.query = filters.query;
      pipelineSkillPickerState.selectedCategory = filters.tag;
      renderPipelineSkillPickerModal();
    },
    renderRecord: (skill) => renderSkillResult(skill),
  });
  const search = controls.querySelector<HTMLInputElement>('input');
  if (search) search.className = `${search.className} skill-search pipeline-skill-picker-search`.trim();
  const filters = controls.querySelector<HTMLElement>('.codex-library-tag-filters');
  if (filters) filters.className = `${filters.className} skill-category-filters pipeline-skill-picker-filters`.trim();
  pipelineSkillPickerModal.replaceChildren(head, controls, results, renderActions());
  if (focusKey) {
    const nextFocus = pipelineSkillPickerModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
  }
}

export function openPipelineSkillPicker(input: {
  stepId: string;
  stepName: string;
  stepSkillNames: readonly string[];
  skills: readonly CodexPipelineContentSummary[];
  insertionIndex?: number;
  requestProjectId: string;
  onInsert: (selection: PipelineSkillPickerSelection) => void;
  reloadSkills?: () => Promise<readonly CodexPipelineContentSummary[]>;
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
    requestProjectId: input.requestProjectId,
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
  const selected = selectedSkill();
  if (!selected) return;
  const onInsert = pipelineSkillPickerState.onInsert;
  const insertionIndex = pipelineSkillPickerState.insertionIndex;
  closePipelineSkillPicker();
  onInsert?.({ skillName: selected.name, contentKind: selected.contentKind, insertionIndex });
}

export function closePipelineSkillPicker(): void {
  pickerGeneration += 1;
  pipelineSkillPickerModal?.close?.();
}
