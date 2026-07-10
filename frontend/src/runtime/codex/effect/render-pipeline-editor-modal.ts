/**
 * WHAT: Renders and manages reusable pipeline definitions and their ordered step skills.
 * WHY: Operators need one durable editor for step reuse, ordering, insertion, and inherited run settings.
 */
import type {
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineSkill,
  CodexPipelineStep,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { pipelineEditorModal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { codexEffortOptions, codexModelOptions, type CodexEffort, type CodexModel } from '../helper/codex-run-options.js';
import { loadCodexSkillsResult, type CodexSkillSummary } from './load-codex-skills.js';
import {
  requestCodexPipelineSave,
  type CodexPipelineSaveResult,
  type CodexPipelineSaveRequest,
} from './request-codex-pipeline-save.js';
import { closePipelineSkillPicker, openPipelineSkillPicker } from './render-pipeline-skill-picker-modal.js';

type PipelineSkillDraft = {
  id: string;
  skillName: string;
  codexModel: CodexModel | null;
  codexEffort: CodexEffort | null;
};

type PipelineStepDraft = {
  id: string;
  name: string;
  purpose: string;
  skills: PipelineSkillDraft[];
  createdAt?: string;
  updatedAt?: string;
};

export type PipelineEditorState = {
  pipelineId: string;
  existingPipelineId: string;
  name: string;
  purpose: string;
  createdAt?: string;
  updatedAt?: string;
  steps: PipelineStepDraft[];
  skills: CodexSkillSummary[];
  openStepId: string;
  selectedSkillName: string;
  insertionIndex: number;
  loadingSkills: boolean;
  skillCatalogError: string;
  saving: boolean;
  error: string;
  notice: string;
  warnings: CodexPipelineInvalidReference[];
  onSaved?: (result: CodexPipelineSaveResult) => void | Promise<void>;
  onSaveError?: (message: string) => void;
};

export const pipelineEditorState: PipelineEditorState = {
  pipelineId: '',
  existingPipelineId: '',
  name: '',
  purpose: '',
  steps: [],
  skills: [],
  openStepId: '',
  selectedSkillName: '',
  insertionIndex: 0,
  loadingSkills: false,
  skillCatalogError: '',
  saving: false,
  error: '',
  notice: '',
  warnings: [],
};

let generatedIdSequence = 0;
let editorLoadGeneration = 0;
let draggedStepId = '';
let draggedSkill: { stepId: string; skillId: string } | null = null;

function generatedId(prefix: string): string {
  generatedIdSequence += 1;
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}-${generatedIdSequence}`;
  return `${prefix}-${random}`;
}

function cloneSkill(skill: CodexPipelineSkill): PipelineSkillDraft {
  return {
    id: skill.id,
    skillName: skill.skillName,
    codexModel: skill.codexModel as CodexModel | null,
    codexEffort: skill.codexEffort as CodexEffort | null,
  };
}

function cloneStep(step: CodexPipelineStep): PipelineStepDraft {
  return {
    id: step.id,
    name: step.name,
    purpose: step.purpose,
    skills: step.skills.map(cloneSkill),
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

function newStep(index: number): PipelineStepDraft {
  return {
    id: generatedId('codex-step'),
    name: `Step ${index + 1}`,
    purpose: '',
    skills: [],
  };
}

function activeStep(): PipelineStepDraft | undefined {
  return pipelineEditorState.steps.find((step) => step.id === pipelineEditorState.openStepId);
}

function skillSummary(skillName: string): CodexSkillSummary | undefined {
  return pipelineEditorState.skills.find((skill) => skill.name === skillName);
}

function showEditor(): void {
  if (!pipelineEditorModal?.open) pipelineEditorModal?.showModal?.();
}

function makeButton(label: string, onClick: () => void, className = 'ghost-button', focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (focusKey) element.dataset.codexFocusKey = focusKey;
  element.addEventListener('click', onClick);
  return element;
}

function effectiveSetting(skillName: string, kind: 'model' | 'effort'): string {
  const summary = skillSummary(skillName);
  return kind === 'model'
    ? summary?.effectiveCodexModel || 'workspace fallback'
    : summary?.effectiveCodexEffort || 'workspace fallback';
}

export function renderInheritedRunOption<T extends string>(input: {
  label: string;
  value: T | null;
  options: readonly T[];
  effectiveValue: string;
  onChange: (value: T | null) => void;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'pipeline-run-option';
  const heading = document.createElement('span');
  heading.textContent = input.label;
  const select = document.createElement('select');
  select.setAttribute('aria-label', input.label);
  const inherited = document.createElement('option');
  inherited.value = '';
  inherited.textContent = 'Use skill default';
  select.append(inherited);
  for (const value of input.options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value ?? '';
  select.addEventListener('change', () => input.onChange((select.value || null) as T | null));
  const inheritedValue = document.createElement('small');
  inheritedValue.className = 'pipeline-inherited-value';
  inheritedValue.textContent = input.value === null ? `Current default: ${input.effectiveValue}` : 'Explicit for this pipeline step';
  label.replaceChildren(heading, select, inheritedValue);
  return label;
}

function renderSkillSequence(step: PipelineStepDraft): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pipeline-skill-sequence';
  const head = document.createElement('header');
  head.className = 'pipeline-mini-head';
  const title = document.createElement('h4');
  title.textContent = 'Skill order';
  const headActions = document.createElement('div');
  headActions.className = 'pipeline-mini-actions';
  const hint = document.createElement('span');
  hint.className = 'codex-hint';
  hint.textContent = 'Drag skills or use the arrow controls.';
  const add = makeButton(
    pipelineEditorState.loadingSkills ? 'Loading skills…' : 'Add skill',
    () => openStepSkillPicker(step),
    'primary-action',
    `step-add-skill:${step.id}`,
  );
  add.disabled = pipelineEditorState.loadingSkills || Boolean(pipelineEditorState.skillCatalogError) || pipelineEditorState.skills.length === 0;
  headActions.replaceChildren(hint, add);
  head.replaceChildren(title, headActions);
  const list = document.createElement('ol');
  if (step.skills.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'pipeline-sequence-empty';
    empty.textContent = 'No skills in this step yet.';
    list.append(empty);
  }
  step.skills.forEach((skill, index) => {
    const item = document.createElement('li');
    item.className = 'pipeline-skill-item';
    item.dataset.pipelineSkillId = skill.id;
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      if (draggedSkill?.stepId === step.id) reorderStepSkill(step.id, draggedSkill.skillId, skill.id);
      draggedSkill = null;
    });
    const row = document.createElement('div');
    row.className = 'pipeline-skill-item-head';
    const drag = document.createElement('span');
    drag.className = 'pipeline-drag-handle';
    drag.title = 'Drag skill';
    drag.textContent = '::';
    drag.draggable = true;
    drag.addEventListener('dragstart', () => { draggedSkill = { stepId: step.id, skillId: skill.id }; });
    const name = document.createElement('strong');
    name.textContent = skill.skillName;
    const controls = document.createElement('span');
    controls.className = 'pipeline-order-controls';
    const up = makeButton('↑', () => moveStepSkill(step.id, skill.id, -1), 'icon-button ghost-button', `skill-up:${step.id}:${skill.id}`);
    up.title = 'Move skill earlier';
    up.setAttribute('aria-label', up.title);
    up.disabled = index === 0;
    const down = makeButton('↓', () => moveStepSkill(step.id, skill.id, 1), 'icon-button ghost-button', `skill-down:${step.id}:${skill.id}`);
    down.title = 'Move skill later';
    down.setAttribute('aria-label', down.title);
    down.disabled = index === step.skills.length - 1;
    const remove = makeButton('−', () => removeStepSkill(step.id, skill.id), 'icon-button ghost-button', `skill-remove:${step.id}:${skill.id}`);
    remove.title = 'Remove skill from step';
    remove.setAttribute('aria-label', remove.title);
    controls.replaceChildren(up, down, remove);
    row.replaceChildren(drag, name, controls);
    const settings = document.createElement('div');
    settings.className = 'pipeline-skill-settings';
    settings.replaceChildren(
      renderInheritedRunOption({
        label: 'Model',
        value: skill.codexModel,
        options: codexModelOptions,
        effectiveValue: effectiveSetting(skill.skillName, 'model'),
        onChange: (value) => {
          skill.codexModel = value;
          renderPipelineEditorModal();
        },
      }),
      renderInheritedRunOption({
        label: 'Effort',
        value: skill.codexEffort,
        options: codexEffortOptions,
        effectiveValue: effectiveSetting(skill.skillName, 'effort'),
        onChange: (value) => {
          skill.codexEffort = value;
          renderPipelineEditorModal();
        },
      }),
    );
    item.replaceChildren(row, settings);
    list.append(item);
  });
  section.replaceChildren(head, list);
  if (pipelineEditorState.skillCatalogError) {
    const error = document.createElement('div');
    error.className = 'pipeline-skill-catalog-error';
    const message = document.createElement('p');
    message.className = 'codex-form-error';
    message.textContent = pipelineEditorState.skillCatalogError;
    error.replaceChildren(message, makeButton('Retry skill catalog', () => { void reloadPipelineEditorSkills(); }, 'ghost-button', 'skill-catalog-retry'));
    section.append(error);
  }
  return section;
}

function openStepSkillPicker(step: PipelineStepDraft): void {
  openPipelineSkillPicker({
    stepId: step.id,
    stepName: step.name,
    stepSkillNames: step.skills.map((skill) => skill.skillName),
    skills: pipelineEditorState.skills,
    insertionIndex: step.skills.length,
    onInsert: ({ skillName, insertionIndex }) => {
      pipelineEditorState.selectedSkillName = skillName;
      pipelineEditorState.insertionIndex = insertionIndex;
      addSkillToStep(step.id);
    },
    reloadSkills: async () => {
      await reloadPipelineEditorSkills();
      return pipelineEditorState.skills;
    },
  });
}

function renderOpenStep(step: PipelineStepDraft): HTMLElement {
  const body = document.createElement('div');
  body.className = 'pipeline-open-step';
  const fields = document.createElement('div');
  fields.className = 'pipeline-step-fields';
  const nameField = document.createElement('label');
  nameField.className = 'codex-field';
  const nameLabel = document.createElement('span');
  nameLabel.textContent = 'Step name';
  const name = document.createElement('input');
  name.value = step.name;
  name.addEventListener('input', () => { step.name = name.value; });
  nameField.replaceChildren(nameLabel, name);
  const purposeField = document.createElement('label');
  purposeField.className = 'codex-field';
  const purposeLabel = document.createElement('span');
  purposeLabel.textContent = 'Step purpose';
  const purpose = document.createElement('input');
  purpose.value = step.purpose;
  purpose.addEventListener('input', () => { step.purpose = purpose.value; });
  purposeField.replaceChildren(purposeLabel, purpose);
  fields.replaceChildren(nameField, purposeField);
  body.replaceChildren(fields, renderSkillSequence(step));
  return body;
}

function renderStepList(): HTMLElement {
  const list = document.createElement('ol');
  list.className = 'pipeline-step-list';
  pipelineEditorState.steps.forEach((step, index) => {
    const open = step.id === pipelineEditorState.openStepId;
    const item = document.createElement('li');
    item.className = `pipeline-step-card${open ? ' is-open' : ''}`;
    item.dataset.pipelineStepId = step.id;
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      if (draggedStepId) reorderPipelineStep(draggedStepId, step.id);
      draggedStepId = '';
    });
    const summary = document.createElement('div');
    summary.className = 'pipeline-step-summary';
    const drag = document.createElement('span');
    drag.className = 'pipeline-drag-handle';
    drag.title = 'Drag step';
    drag.textContent = '::';
    drag.draggable = true;
    drag.addEventListener('dragstart', () => { draggedStepId = step.id; });
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = step.name || `Step ${index + 1}`;
    const purpose = document.createElement('p');
    purpose.textContent = step.purpose || `${step.skills.length} configured skill${step.skills.length === 1 ? '' : 's'}`;
    copy.replaceChildren(title, purpose);
    const controls = document.createElement('span');
    controls.className = 'pipeline-order-controls';
    const up = makeButton('↑', () => movePipelineStep(step.id, -1), 'icon-button ghost-button', `step-up:${step.id}`);
    up.title = 'Move step earlier';
    up.setAttribute('aria-label', up.title);
    up.disabled = index === 0;
    const down = makeButton('↓', () => movePipelineStep(step.id, 1), 'icon-button ghost-button', `step-down:${step.id}`);
    down.title = 'Move step later';
    down.setAttribute('aria-label', down.title);
    down.disabled = index === pipelineEditorState.steps.length - 1;
    const edit = makeButton(open ? 'Done' : 'Edit', () => editPipelineStep(open ? '' : step.id), 'ghost-button', `step-edit:${step.id}`);
    const remove = makeButton('Remove step', () => removePipelineStep(step.id), 'ghost-button', `step-remove:${step.id}`);
    remove.setAttribute('aria-label', `Remove ${step.name || `step ${index + 1}`} from this pipeline`);
    controls.replaceChildren(up, down, edit, remove);
    summary.replaceChildren(drag, copy, controls);
    item.replaceChildren(summary, ...(open ? [renderOpenStep(step)] : []));
    list.append(item);
  });
  if (pipelineEditorState.steps.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'codex-empty-state pipeline-empty-steps';
    empty.textContent = 'No steps yet. Add the first reusable step to continue.';
    list.append(empty);
  }
  return list;
}

export function renderPipelineEditorModal(): void {
  if (!pipelineEditorModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  pipelineEditorModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = pipelineEditorState.existingPipelineId ? 'Edit pipeline' : 'New pipeline';
  const title = document.createElement('h2');
  title.id = 'pipeline-editor-modal-title';
  title.textContent = pipelineEditorState.name || 'Untitled pipeline';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Create reusable steps, order their skills, and choose explicit or inherited run settings.';
  copy.replaceChildren(kicker, title, subtitle);
  const headActions = document.createElement('div');
  headActions.className = 'codex-head-actions';
  const save = makeButton(pipelineEditorState.saving ? 'Saving…' : 'Save pipeline', () => { void savePipelineDraft(); }, 'primary-action', 'pipeline-save');
  save.disabled = pipelineEditorState.saving;
  const close = makeButton('×', closePipelineEditor, 'plain-close', 'pipeline-close');
  close.setAttribute('aria-label', 'Close pipeline editor');
  headActions.replaceChildren(save, close);
  head.replaceChildren(copy, headActions);

  const form = document.createElement('section');
  form.className = 'pipeline-definition-fields';
  const nameField = document.createElement('label');
  nameField.className = 'codex-field';
  const nameLabel = document.createElement('span');
  nameLabel.textContent = 'Pipeline name';
  const name = document.createElement('input');
  name.value = pipelineEditorState.name;
  name.placeholder = 'Pipeline name';
  name.addEventListener('input', () => {
    pipelineEditorState.name = name.value;
    title.textContent = name.value || 'Untitled pipeline';
  });
  nameField.replaceChildren(nameLabel, name);
  const purposeField = document.createElement('label');
  purposeField.className = 'codex-field';
  const purposeLabel = document.createElement('span');
  purposeLabel.textContent = 'Purpose';
  const purpose = document.createElement('input');
  purpose.value = pipelineEditorState.purpose;
  purpose.placeholder = 'What this pipeline produces';
  purpose.addEventListener('input', () => { pipelineEditorState.purpose = purpose.value; });
  purposeField.replaceChildren(purposeLabel, purpose);
  form.replaceChildren(nameField, purposeField);

  const feedback = document.createElement('div');
  feedback.className = 'pipeline-editor-feedback';
  if (pipelineEditorState.error) {
    const error = document.createElement('p');
    error.className = 'codex-form-error';
    error.setAttribute('role', 'alert');
    error.textContent = pipelineEditorState.error;
    feedback.append(error);
  } else if (pipelineEditorState.notice) {
    const notice = document.createElement('p');
    notice.className = 'codex-form-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = pipelineEditorState.notice;
    feedback.append(notice);
  }
  if (pipelineEditorState.warnings.length > 0) {
    const warning = document.createElement('p');
    warning.className = 'codex-inline-warning';
    warning.textContent = `${pipelineEditorState.warnings.length} invalid reference${pipelineEditorState.warnings.length === 1 ? '' : 's'} must be repaired before this pipeline can run.`;
    feedback.append(warning);
  }

  const stepEditor = document.createElement('section');
  stepEditor.className = 'pipeline-step-editor';
  const stepHead = document.createElement('header');
  stepHead.className = 'pipeline-section-head';
  const stepTitle = document.createElement('h3');
  stepTitle.textContent = 'Steps';
  stepHead.replaceChildren(stepTitle, makeButton('New step', addPipelineStep, 'ghost-button', 'pipeline-new-step'));
  stepEditor.replaceChildren(stepHead, renderStepList());
  pipelineEditorModal.replaceChildren(head, form, feedback, stepEditor);
  if (focusKey) {
    const nextFocus = pipelineEditorModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
    else pipelineEditorModal.focus();
  }
}

export async function openPipelineEditor(input: {
  pipeline?: CodexPipeline;
  steps?: readonly CodexPipelineStep[];
  skills?: readonly CodexSkillSummary[];
  invalidReferences?: readonly CodexPipelineInvalidReference[];
  onSaved?: PipelineEditorState['onSaved'];
  onSaveError?: PipelineEditorState['onSaveError'];
} = {}): Promise<void> {
  const pipeline = input.pipeline;
  const stepById = new Map((input.steps ?? []).map((step) => [step.id, step]));
  const referencedSteps = pipeline
    ? pipeline.stepIds.map((id) => stepById.get(id)).filter((step): step is CodexPipelineStep => Boolean(step)).map(cloneStep)
    : [newStep(0)];
  const pipelineId = pipeline?.id ?? generatedId('codex-pipeline');
  const generation = ++editorLoadGeneration;
  Object.assign(pipelineEditorState, {
    pipelineId,
    existingPipelineId: pipeline?.id ?? '',
    name: pipeline?.name ?? '',
    purpose: pipeline?.purpose ?? '',
    createdAt: pipeline?.createdAt,
    updatedAt: pipeline?.updatedAt,
    steps: referencedSteps,
    skills: input.skills ? [...input.skills] : [],
    openStepId: referencedSteps[0]?.id ?? '',
    selectedSkillName: input.skills?.[0]?.name ?? '',
    insertionIndex: referencedSteps[0]?.skills.length ?? 0,
    loadingSkills: !input.skills,
    skillCatalogError: '',
    saving: false,
    error: '',
    notice: '',
    warnings: (input.invalidReferences ?? []).filter((reference) => !pipeline || reference.pipelineId === pipeline.id),
    onSaved: input.onSaved,
    onSaveError: input.onSaveError,
  });
  renderPipelineEditorModal();
  showEditor();
  telemetry('codex-pipeline-editor-open', { pipelineId, operation: pipeline ? 'update' : 'create' });
  if (!input.skills) {
    const result = await loadCodexSkillsResult();
    if (generation !== editorLoadGeneration) return;
    pipelineEditorState.skills = result.skills;
    pipelineEditorState.skillCatalogError = result.ok ? '' : result.error || 'Could not load Codex skills.';
    pipelineEditorState.loadingSkills = false;
    pipelineEditorState.selectedSkillName = result.skills[0]?.name ?? '';
    renderPipelineEditorModal();
  }
}

export function addPipelineStep(): void {
  const step = newStep(pipelineEditorState.steps.length);
  pipelineEditorState.steps.push(step);
  pipelineEditorState.openStepId = step.id;
  pipelineEditorState.insertionIndex = 0;
  pipelineEditorState.error = '';
  renderPipelineEditorModal();
}

export function editPipelineStep(stepId: string): void {
  pipelineEditorState.openStepId = stepId;
  pipelineEditorState.insertionIndex = activeStep()?.skills.length ?? 0;
  renderPipelineEditorModal();
}

export function movePipelineStep(stepId: string, direction: -1 | 1): void {
  const from = pipelineEditorState.steps.findIndex((step) => step.id === stepId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= pipelineEditorState.steps.length) return;
  const [step] = pipelineEditorState.steps.splice(from, 1);
  pipelineEditorState.steps.splice(to, 0, step);
  renderPipelineEditorModal();
}

export function reorderPipelineStep(sourceStepId: string, targetStepId: string): void {
  const source = pipelineEditorState.steps.findIndex((step) => step.id === sourceStepId);
  const target = pipelineEditorState.steps.findIndex((step) => step.id === targetStepId);
  if (source < 0 || target < 0 || source === target) return;
  const [step] = pipelineEditorState.steps.splice(source, 1);
  pipelineEditorState.steps.splice(target, 0, step);
  renderPipelineEditorModal();
}

export function moveStepSkill(stepId: string, skillId: string, direction: -1 | 1): void {
  const step = pipelineEditorState.steps.find((entry) => entry.id === stepId);
  const from = step?.skills.findIndex((skill) => skill.id === skillId) ?? -1;
  const to = from + direction;
  if (!step || from < 0 || to < 0 || to >= step.skills.length) return;
  const [skill] = step.skills.splice(from, 1);
  step.skills.splice(to, 0, skill);
  pipelineEditorState.insertionIndex = Math.min(pipelineEditorState.insertionIndex, step.skills.length);
  renderPipelineEditorModal();
}

export function reorderStepSkill(stepId: string, sourceSkillId: string, targetSkillId: string): void {
  const step = pipelineEditorState.steps.find((entry) => entry.id === stepId);
  const source = step?.skills.findIndex((skill) => skill.id === sourceSkillId) ?? -1;
  const target = step?.skills.findIndex((skill) => skill.id === targetSkillId) ?? -1;
  if (!step || source < 0 || target < 0 || source === target) return;
  const [skill] = step.skills.splice(source, 1);
  step.skills.splice(target, 0, skill);
  renderPipelineEditorModal();
}

export function removeStepSkill(stepId: string, skillId: string): void {
  const step = pipelineEditorState.steps.find((entry) => entry.id === stepId);
  if (!step) return;
  step.skills = step.skills.filter((skill) => skill.id !== skillId);
  pipelineEditorState.insertionIndex = Math.min(pipelineEditorState.insertionIndex, step.skills.length);
  renderPipelineEditorModal();
}

export function removePipelineStep(stepId: string): void {
  const index = pipelineEditorState.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return;
  pipelineEditorState.steps.splice(index, 1);
  if (pipelineEditorState.openStepId === stepId) {
    pipelineEditorState.openStepId = pipelineEditorState.steps[Math.min(index, pipelineEditorState.steps.length - 1)]?.id ?? '';
  }
  pipelineEditorState.insertionIndex = activeStep()?.skills.length ?? 0;
  pipelineEditorState.notice = 'Step removed from this pipeline. The reusable step record remains available to other pipelines.';
  renderPipelineEditorModal();
}

export function selectPipelineEditorSkill(skillName: string): void {
  pipelineEditorState.selectedSkillName = skillName;
  renderPipelineEditorModal();
}

export function addSkillToStep(stepId = pipelineEditorState.openStepId): void {
  const step = pipelineEditorState.steps.find((entry) => entry.id === stepId);
  const skillName = pipelineEditorState.selectedSkillName;
  if (!step || !skillName) return;
  const skill: PipelineSkillDraft = {
    id: generatedId('codex-step-skill'),
    skillName,
    codexModel: null,
    codexEffort: null,
  };
  const index = Math.max(0, Math.min(pipelineEditorState.insertionIndex, step.skills.length));
  step.skills.splice(index, 0, skill);
  pipelineEditorState.insertionIndex = index + 1;
  pipelineEditorState.error = '';
  renderPipelineEditorModal();
}

export function buildPipelineSaveRequest(): CodexPipelineSaveRequest {
  return {
    operation: pipelineEditorState.existingPipelineId ? 'update' : 'create',
    pipelineId: pipelineEditorState.existingPipelineId || undefined,
    pipeline: {
      id: pipelineEditorState.pipelineId,
      name: pipelineEditorState.name.trim(),
      purpose: pipelineEditorState.purpose.trim(),
      stepIds: pipelineEditorState.steps.map((step) => step.id),
      ...(pipelineEditorState.createdAt ? { createdAt: pipelineEditorState.createdAt } : {}),
      ...(pipelineEditorState.updatedAt ? { updatedAt: pipelineEditorState.updatedAt } : {}),
    },
    steps: pipelineEditorState.steps.map((step) => ({
      id: step.id,
      name: step.name.trim(),
      purpose: step.purpose.trim(),
      skills: step.skills.map((skill) => ({ ...skill })),
      ...(step.createdAt ? { createdAt: step.createdAt } : {}),
      ...(step.updatedAt ? { updatedAt: step.updatedAt } : {}),
    })),
  };
}

function validatePipelineDraft(): string {
  if (!pipelineEditorState.name.trim()) return 'Pipeline name is required.';
  if (pipelineEditorState.steps.length === 0) return 'Add at least one step.';
  const unnamedStep = pipelineEditorState.steps.find((step) => !step.name.trim());
  if (unnamedStep) return 'Every step needs a name.';
  const emptyStep = pipelineEditorState.steps.find((step) => step.skills.length === 0);
  if (emptyStep) return `Add at least one skill to ${emptyStep.name}.`;
  return '';
}

export async function savePipelineDraft(): Promise<boolean> {
  if (pipelineEditorState.saving) return false;
  const validationError = validatePipelineDraft();
  if (validationError) {
    pipelineEditorState.error = validationError;
    pipelineEditorState.notice = '';
    renderPipelineEditorModal();
    return false;
  }
  pipelineEditorState.saving = true;
  pipelineEditorState.error = '';
  pipelineEditorState.notice = '';
  renderPipelineEditorModal();
  const generation = editorLoadGeneration;
  const pipelineId = pipelineEditorState.pipelineId;
  const onSaved = pipelineEditorState.onSaved;
  const onSaveError = pipelineEditorState.onSaveError;
  const result = await requestCodexPipelineSave(buildPipelineSaveRequest());
  if (generation !== editorLoadGeneration || pipelineId !== pipelineEditorState.pipelineId) return false;
  pipelineEditorState.saving = false;
  if (!result.ok || !result.pipeline) {
    const message = result.error || 'Could not save this pipeline.';
    pipelineEditorState.error = message;
    onSaveError?.(message);
    telemetry('codex-pipeline-save-failed', { pipelineId: pipelineEditorState.pipelineId, statusCode: result.statusCode });
    renderPipelineEditorModal();
    return false;
  }
  pipelineEditorState.pipelineId = result.pipeline.id;
  pipelineEditorState.existingPipelineId = result.pipeline.id;
  pipelineEditorState.name = result.pipeline.name;
  pipelineEditorState.purpose = result.pipeline.purpose;
  pipelineEditorState.createdAt = result.pipeline.createdAt;
  pipelineEditorState.updatedAt = result.pipeline.updatedAt;
  const savedStepsById = new Map(result.steps.map((step) => [step.id, step]));
  pipelineEditorState.steps = result.pipeline.stepIds
    .map((stepId) => savedStepsById.get(stepId))
    .filter((step): step is CodexPipelineStep => Boolean(step))
    .map(cloneStep);
  pipelineEditorState.warnings = result.invalidReferences.filter((reference) => reference.pipelineId === result.pipeline?.id);
  pipelineEditorState.notice = pipelineEditorState.warnings.length > 0
    ? 'Pipeline saved with reference warnings.'
    : 'Pipeline saved.';
  telemetry('codex-pipeline-saved', { pipelineId: result.pipeline.id, steps: result.pipeline.stepIds.length });
  await onSaved?.(result);
  renderPipelineEditorModal();
  return true;
}

export async function reloadPipelineEditorSkills(): Promise<readonly CodexSkillSummary[]> {
  const generation = ++editorLoadGeneration;
  pipelineEditorState.loadingSkills = true;
  renderPipelineEditorModal();
  const result = await loadCodexSkillsResult();
  if (generation !== editorLoadGeneration) return pipelineEditorState.skills;
  pipelineEditorState.skills = result.skills;
  pipelineEditorState.skillCatalogError = result.ok ? '' : result.error || 'Could not load Codex skills.';
  pipelineEditorState.loadingSkills = false;
  if (!skillSummary(pipelineEditorState.selectedSkillName)) pipelineEditorState.selectedSkillName = result.skills[0]?.name ?? '';
  renderPipelineEditorModal();
  return pipelineEditorState.skills;
}

export function closePipelineEditor(): void {
  editorLoadGeneration += 1;
  closePipelineSkillPicker();
  pipelineEditorModal?.close?.();
}
