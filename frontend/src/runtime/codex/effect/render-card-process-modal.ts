/**
 * WHAT: Renders the combined Process card flow for saved pipelines and direct skills.
 * WHY: Card processing needs one entry point while preserving the one-skill compatibility route.
 */
import type {
  CodexContentKind,
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { controlRoomPath } from '../../../app/responsive/control-room-route.js';
import { processModal } from '../../dom.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { processCardSkillController } from '../controller/process-card-skill-controller.js';
import { renderCodexLibrary } from '../component/render-codex-library.js';
import { renderSkillLibraryEditAction } from '../component/render-skill-library-edit-action.js';
import { renderSkillLibraryItemContent } from '../component/render-skill-library-item-content.js';
import { codexSkillAuthoringProjectId } from '../helper/codex-skill-authoring-path.js';
import { colorForSkillTag, tagsForSkill } from '../helper/skill-library-presentation.js';
import { mergePipelinePromptsIntoSkillCatalog } from '../helper/merge-pipeline-prompts-into-skill-catalog.js';
import { codexEffortOptions, codexModelOptions } from '../helper/codex-run-options.js';
import { loadCodexPipelines, type CodexPipelineContentSummary } from './load-codex-pipelines.js';
import { loadCodexSkillsResult, type CodexSkillSummary } from './load-codex-skills.js';
import { requestCodexPipelineRun } from './request-codex-pipeline-run.js';
import { openPipelineEditor } from './render-pipeline-editor-modal.js';
import { openPipelinesModal } from './render-pipelines-modal.js';
import { openSkillLibraryCreator, openSkillLibraryEditor } from './render-skill-library-editor-modal.js';
import { requestFederatedLibrarySynchronization } from './request-federated-library-synchronization.js';
import { createExecutionRequestId } from '../helper/create-execution-request-id.js';

export type ProcessModalMode = 'pipelines' | 'skills';

export type ProcessModalState = {
  cardId: string;
  mode: ProcessModalMode;
  query: string;
  selectedCategory: string;
  selectedPipelineId: string;
  selectedSkillName: string;
  codexModel: string;
  codexEffort: string;
  codexModelExplicit: boolean;
  codexEffortExplicit: boolean;
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  skills: CodexSkillSummary[];
  pipelineContent: CodexPipelineContentSummary[];
  invalidReferences: readonly CodexPipelineInvalidReference[];
  issues: readonly CodexPipelineStoreIssue[];
  loadingPipelines: boolean;
  loadingSkills: boolean;
  synchronizingLibraries: boolean;
  processing: boolean;
  sourceContentMissing: boolean;
  metadataError: string;
  skillCatalogError: string;
  error: string;
  saveError: string;
  synchronizationMessage: string;
};

export const processModalState: ProcessModalState = {
  cardId: '',
  mode: 'pipelines',
  query: '',
  selectedCategory: 'All',
  selectedPipelineId: '',
  selectedSkillName: '',
  codexModel: '',
  codexEffort: '',
  codexModelExplicit: false,
  codexEffortExplicit: false,
  pipelines: [],
  steps: [],
  skills: [],
  pipelineContent: [],
  invalidReferences: [],
  issues: [],
  loadingPipelines: false,
  loadingSkills: false,
  synchronizingLibraries: false,
  processing: false,
  sourceContentMissing: false,
  metadataError: '',
  skillCatalogError: '',
  error: '',
  saveError: '',
  synchronizationMessage: '',
};

let processLoadGeneration = 0;

function showProcessModal(): void {
  if (!processModal?.open) processModal?.showModal?.();
}

function button(label: string, onClick: () => void, className = 'ghost-button', focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (focusKey) element.dataset.codexFocusKey = focusKey;
  element.addEventListener('click', onClick);
  return element;
}

function activeLedgerCard(cardId: string): Record<string, unknown> | null {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  return cards.find((card) => String(card.id ?? '') === cardId) ?? null;
}

export function hasProcessSourceContent(cardId: string): boolean {
  const card = activeLedgerCard(cardId);
  const escape = globalThis.CSS?.escape ?? ((value: string) => value.replace(/["\\]/g, '\\$&'));
  if (!card) return Boolean(globalThis.document?.querySelector?.(`[data-card-id="${escape(cardId)}"]`));
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as Record<string, unknown>
    : {};
  const content = comment.what ?? comment.body ?? comment.description ?? '';
  return typeof content === 'string' && content.trim().length > 0;
}

function stepsById(): Map<string, CodexPipelineStep> {
  return new Map(processModalState.steps.map((step) => [step.id, step]));
}

function selectedPipeline(): CodexPipeline | undefined {
  return processModalState.pipelines.find((pipeline) => pipeline.id === processModalState.selectedPipelineId);
}

function selectedSkill(): CodexSkillSummary | undefined {
  return processModalState.skills.find((skill) => skill.name === processModalState.selectedSkillName);
}

function directSkills(): CodexSkillSummary[] {
  return processModalState.skills;
}

function directContentKind(skill: CodexSkillSummary): CodexContentKind {
  if (skill.contentKind === 'pipeline-prompt' || skill.source === 'pipeline-prompt') return 'pipeline-prompt';
  if (skill.contentKind === 'workspace-skill' || skill.source !== 'server') return 'workspace-skill';
  return 'federated-skill';
}

function pipelineReferences(pipelineId: string): readonly CodexPipelineInvalidReference[] {
  return processModalState.invalidReferences.filter((reference) => reference.pipelineId === pipelineId);
}

function pipelineCategories(pipeline: CodexPipeline): string[] {
  const stepLookup = stepsById();
  const categories = new Set<string>();
  for (const stepId of pipeline.stepIds) {
    const step = stepLookup.get(stepId);
    for (const skill of step?.skills ?? []) {
      const catalogSkill = processModalState.pipelineContent.find((entry) => entry.name === skill.skillName);
      tagsForSkill(catalogSkill ?? { name: skill.skillName }).forEach((tag) => categories.add(tag));
    }
  }
  return [...categories];
}

function pipelineSkillNames(pipeline: CodexPipeline): string[] {
  const stepLookup = stepsById();
  return pipeline.stepIds.flatMap((stepId) => stepLookup.get(stepId)?.skills.map((skill) => skill.skillName) ?? []);
}

function pipelineCanRun(pipeline: CodexPipeline): boolean {
  if (pipelineReferences(pipeline.id).length > 0 || pipeline.stepIds.length === 0) return false;
  const stepLookup = stepsById();
  const availableSkills = new Set(processModalState.pipelineContent.map((skill) => skill.name));
  return pipeline.stepIds.every((stepId) => {
    const step = stepLookup.get(stepId);
    return Boolean(step && step.skills.length > 0 && step.skills.every((skill) => availableSkills.has(skill.skillName)));
  });
}

function renderTabs(): HTMLElement {
  const tabs = document.createElement('nav');
  tabs.className = 'process-mode-tabs';
  tabs.setAttribute('aria-label', 'Process mode');
  tabs.setAttribute('role', 'tablist');
  for (const mode of ['pipelines', 'skills'] as const) {
    const selected = processModalState.mode === mode;
    const tab = button(mode === 'pipelines' ? 'Pipelines' : 'Skills', () => setCardProcessTab(mode, true), `process-mode-tab${selected ? ' is-selected' : ''}`, `process-tab:${mode}`);
    tab.id = `process-tab-${mode}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('aria-controls', `process-panel-${mode}`);
    tab.tabIndex = selected ? 0 : -1;
    tab.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboardEvent.key)) return;
      keyboardEvent.preventDefault();
      const next = keyboardEvent.key === 'ArrowLeft' || keyboardEvent.key === 'Home' ? 'pipelines' : 'skills';
      setCardProcessTab(next, true);
    });
    tabs.append(tab);
  }
  return tabs;
}

function renderPipelineResult(pipeline: CodexPipeline): HTMLButtonElement {
  const selected = pipeline.id === processModalState.selectedPipelineId;
  const categories = pipelineCategories(pipeline);
  const runnable = pipelineCanRun(pipeline);
  const result = button('', () => selectProcessPipeline(pipeline.id), `process-result${selected ? ' is-selected' : ''}${runnable ? '' : ' has-warning'}`);
  result.dataset.processPipelineId = pipeline.id;
  if (categories[0]) result.style.setProperty('--skill-category-color', colorForSkillTag(categories[0]));
  result.setAttribute('aria-pressed', String(selected));
  const head = document.createElement('span');
  head.className = 'skill-result-header';
  const name = document.createElement('span');
  name.className = 'skill-result-name';
  name.textContent = pipeline.name;
  const badge = document.createElement('span');
  badge.className = 'skill-result-category';
  badge.textContent = runnable ? (categories[0] ?? 'Pipeline') : 'Needs repair';
  if (categories[0]) badge.style.setProperty('--skill-category-color', colorForSkillTag(categories[0]));
  head.replaceChildren(name, badge);
  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = pipeline.purpose || 'No purpose provided.';
  const metadata = document.createElement('span');
  metadata.className = 'process-result-metadata';
  metadata.textContent = `${pipeline.stepIds.length} step${pipeline.stepIds.length === 1 ? '' : 's'} · ${pipelineSkillNames(pipeline).join(' → ') || 'no configured skills'}`;
  result.replaceChildren(head, description, metadata);
  return result;
}

function renderSkillResult(skill: CodexSkillSummary): HTMLElement {
  const selected = skill.name === processModalState.selectedSkillName;
  const category = tagsForSkill(skill)[0];
  const row = document.createElement('article');
  row.className = `process-skill-row${selected ? ' is-selected' : ''}`;
  row.style.setProperty('--skill-category-color', colorForSkillTag(category));
  const select = button('', () => selectProcessSkill(skill.name), 'process-skill-select');
  select.dataset.processSkillName = skill.name;
  select.setAttribute('aria-pressed', String(selected));
  const defaults = document.createElement('span');
  defaults.className = 'process-result-metadata';
  defaults.textContent = `${skill.effectiveCodexModel} · ${skill.effectiveCodexEffort}`;
  select.replaceChildren(...renderSkillLibraryItemContent(skill), defaults);
  const editCell = renderSkillLibraryEditAction({
    ...skill,
    onEdit: () => {
      const generation = processLoadGeneration;
      const cardId = processModalState.cardId;
      void openSkillLibraryEditor({
        skillName: skill.name,
        requestProjectId: codexSkillAuthoringProjectId(skill, state.projectId),
        onSaved: async () => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          await reloadProcessSkills();
        },
        onSaveError: (message) => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          processModalState.saveError = `Skill save failed: ${message}`;
          renderCardProcessModal();
        },
      });
    },
  });
  row.replaceChildren(select, editCell);
  return row;
}

function renderLibrarySurface(): { controls: HTMLElement; panels: HTMLElement[] } {
  const controls = document.createElement('div');
  controls.className = 'process-library-controls';
  const results = document.createElement('section');
  results.className = 'process-results';
  results.id = `process-panel-${processModalState.mode}`;
  results.setAttribute('role', 'tabpanel');
  results.setAttribute('aria-labelledby', `process-tab-${processModalState.mode}`);
  const filters = { query: processModalState.query, projectId: 'All', tag: processModalState.selectedCategory };
  const onFiltersChanged = (next: typeof filters): void => {
    processModalState.query = next.query;
    processModalState.selectedCategory = next.tag;
    renderCardProcessModal();
    processModal?.querySelector<HTMLInputElement>('.process-search')?.focus();
  };
  const synchronize = (): void => { void resynchronizeProcessLibraries(); };
  const loading = processModalState.mode === 'pipelines' ? processModalState.loadingPipelines : processModalState.loadingSkills;
  if (processModalState.mode === 'pipelines') {
    const records = processModalState.pipelines.map((pipeline) => ({
      ...pipeline,
      description: pipeline.purpose,
      tags: pipelineCategories(pipeline),
      searchText: pipelineSkillNames(pipeline).join(' '),
    }));
    renderCodexLibrary<CodexPipeline & { description: string; tags: string[]; searchText: string }>({
      records: loading ? [] : records,
      projects: [],
      filters,
      controlsHost: controls,
      resultsHost: results,
      selectedId: processModalState.selectedPipelineId,
      emptyMessage: loading ? 'Loading pipelines…' : records.length === 0 ? 'No saved pipelines yet.' : 'No matching pipelines.',
      resultCountLabel: 'pipeline results',
      synchronizing: processModalState.synchronizingLibraries,
      onSynchronize: synchronize,
      renderRecord: renderPipelineResult,
      onFiltersChanged,
    });
    if (!loading && results.dataset.resultCount === '0' && records.length === 0) {
      results.append(button('Create pipeline', () => editProcessPipeline(), 'primary-action'));
    }
  } else {
    const records = directSkills().map((skill) => ({ ...skill, id: skill.name, tags: tagsForSkill(skill) }));
    renderCodexLibrary<CodexSkillSummary & { id: string; tags: string[] }>({
      records: loading ? [] : records,
      projects: [],
      filters,
      controlsHost: controls,
      resultsHost: results,
      selectedId: processModalState.selectedSkillName,
      favoriteFirst: true,
      emptyMessage: loading ? 'Loading skills…' : records.length === 0 ? 'No skills are available.' : 'No matching skills.',
      resultCountLabel: 'skill results',
      synchronizing: processModalState.synchronizingLibraries,
      onSynchronize: synchronize,
      renderRecord: renderSkillResult,
      onFiltersChanged,
    });
    controls.append(button('Create skill', () => {
      const generation = processLoadGeneration;
      const cardId = processModalState.cardId;
      openSkillLibraryCreator({
        requestProjectId: state.projectId,
        projects: state.projectId ? [{ id: state.projectId, name: state.projectName || state.projectId }] : [],
        onSaved: async () => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          await reloadProcessSkills();
        },
      });
    }, 'primary-action', 'process-create-skill'));
  }
  const search = controls.querySelector<HTMLInputElement>('.codex-library-query');
  if (search) search.className = `${search.className} process-search`;
  const categoryFilters = controls.querySelector<HTMLElement>('.codex-library-tag-filters');
  if (categoryFilters) categoryFilters.className = `${categoryFilters.className} process-category-filters`;
  const panels = (['pipelines', 'skills'] as const).map((mode) => {
    if (mode === processModalState.mode) return results;
    const panel = document.createElement('section');
    panel.className = 'process-results';
    panel.id = `process-panel-${mode}`;
    panel.hidden = true;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `process-tab-${mode}`);
    return panel;
  });
  return { controls, panels };
}

function runSelect(input: {
  label: string;
  hint: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'skill-run-field';
  const title = document.createElement('span');
  title.textContent = input.label;
  const select = document.createElement('select');
  select.setAttribute('aria-label', input.label);
  const values = input.options.includes(input.value) || !input.value ? input.options : [input.value, ...input.options];
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value || input.options[0] || '';
  const hint = document.createElement('small');
  hint.className = 'direct-run-setting-hint';
  hint.textContent = input.hint;
  select.addEventListener('change', () => {
    input.onChange(select.value);
    hint.textContent = 'One-run override';
  });
  label.replaceChildren(title, select, hint);
  return label;
}

function renderDirectRunControls(): HTMLElement | null {
  const skill = selectedSkill();
  if (processModalState.mode !== 'skills' || !skill) return null;
  const controls = document.createElement('div');
  controls.className = 'skill-run-controls process-run-controls';
  controls.replaceChildren(
    runSelect({
      label: `Model · default ${skill.effectiveCodexModel}`,
      hint: processModalState.codexModelExplicit ? 'One-run override' : 'Using skill default',
      value: processModalState.codexModel,
      options: codexModelOptions,
      onChange: (value) => {
        processModalState.codexModel = value;
        processModalState.codexModelExplicit = true;
        telemetry('codex-skill-model-selected', { cardId: processModalState.cardId, codexModel: value });
      },
    }),
    runSelect({
      label: `Effort · default ${skill.effectiveCodexEffort}`,
      hint: processModalState.codexEffortExplicit ? 'One-run override' : 'Using skill default',
      value: processModalState.codexEffort,
      options: codexEffortOptions,
      onChange: (value) => {
        processModalState.codexEffort = value;
        processModalState.codexEffortExplicit = true;
        telemetry('codex-skill-effort-selected', { cardId: processModalState.cardId, codexEffort: value });
      },
    }),
  );
  return controls;
}

function renderFeedback(): HTMLElement {
  const feedback = document.createElement('div');
  feedback.className = 'process-feedback';
  const messages: Array<{ className: string; text: string }> = [];
  if (processModalState.sourceContentMissing) messages.push({ className: 'codex-form-error', text: 'Source card content is unavailable. Add card content before processing it.' });
  if (processModalState.mode === 'pipelines' && processModalState.metadataError) messages.push({ className: 'codex-form-error', text: processModalState.metadataError });
  if (processModalState.skillCatalogError) messages.push({ className: 'codex-form-error', text: processModalState.skillCatalogError });
  if (processModalState.error) messages.push({ className: 'codex-form-error', text: processModalState.error });
  if (processModalState.saveError) messages.push({ className: 'codex-form-error', text: processModalState.saveError });
  if (processModalState.synchronizationMessage) messages.push({ className: 'codex-form-notice', text: processModalState.synchronizationMessage });
  for (const message of messages) {
    const line = document.createElement('p');
    line.className = message.className;
    line.setAttribute('role', 'alert');
    line.textContent = message.text;
    feedback.append(line);
  }
  return feedback;
}

function renderActions(): HTMLElement {
  const actions = document.createElement('footer');
  actions.className = 'codex-modal-actions process-actions';
  const selectedName = document.createElement('span');
  selectedName.className = 'skill-selected-name';
  selectedName.textContent = processModalState.mode === 'pipelines'
    ? selectedPipeline()?.name ?? 'Choose a pipeline'
    : selectedSkill()?.name ?? 'Choose a skill';
  actions.append(selectedName);
  if (processModalState.mode === 'pipelines') {
    actions.append(button('Manage pipelines', () => {
      const generation = processLoadGeneration;
      const cardId = processModalState.cardId;
      void openPipelinesModal({
        onLibraryChanged: (result) => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          processModalState.pipelines = result.pipelines;
          processModalState.steps = result.steps;
          processModalState.invalidReferences = result.invalidReferences;
          processModalState.issues = result.issues;
          processModalState.selectedPipelineId = result.pipeline?.id ?? processModalState.selectedPipelineId;
          renderCardProcessModal();
        },
      });
    }, 'ghost-button', 'process-manage-pipelines'));
    const pipeline = selectedPipeline();
    if (pipeline) actions.append(button('Edit pipeline', editProcessPipeline, 'ghost-button', 'process-edit-pipeline'));
    const run = button(processModalState.processing ? 'Starting…' : 'Run pipeline', () => { void runSelectedPipeline(); }, 'primary-action', 'process-run');
    run.disabled = !pipeline || !pipelineCanRun(pipeline) || processModalState.processing || processModalState.sourceContentMissing;
    actions.append(run);
  } else {
    const run = button(processModalState.processing ? 'Starting…' : 'Run one skill', () => { void processSelectedCardSkill(); }, 'primary-action', 'process-run');
    run.disabled = !selectedSkill() || processModalState.processing || processModalState.sourceContentMissing;
    actions.append(run);
  }
  actions.append(button('Close', closeCardProcessModal, 'ghost-button', 'process-close'));
  return actions;
}

export function renderCardProcessModal(): void {
  if (!processModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  processModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head process-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Codex processing';
  const title = document.createElement('h2');
  title.id = 'card-process-modal-title';
  title.textContent = 'Process card';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Run a reusable step pipeline or process this card with one skill.';
  copy.replaceChildren(kicker, title, subtitle);
  const close = button('×', closeCardProcessModal, 'plain-close', 'process-head-close');
  close.setAttribute('aria-label', 'Close Process card');
  const headActions = document.createElement('div');
  headActions.className = 'codex-head-actions';
  headActions.replaceChildren(close);
  head.replaceChildren(copy, headActions);
  const library = renderLibrarySurface();
  const runControls = renderDirectRunControls();
  processModal.replaceChildren(
    head,
    renderTabs(),
    library.controls,
    ...(runControls ? [runControls] : []),
    renderFeedback(),
    ...library.panels,
    renderActions(),
  );
  if (focusKey) {
    const nextFocus = processModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
    else processModal.focus();
  }
}

export async function openCardProcessModal(cardId: string, initialMode: ProcessModalMode = 'pipelines'): Promise<void> {
  const normalizedCardId = cardId.trim();
  if (!normalizedCardId) return;
  const generation = ++processLoadGeneration;
  Object.assign(processModalState, {
    cardId: normalizedCardId,
    mode: initialMode,
    query: '',
    selectedCategory: 'All',
    selectedPipelineId: '',
    selectedSkillName: '',
    codexModel: '',
    codexEffort: '',
    codexModelExplicit: false,
    codexEffortExplicit: false,
    pipelines: [],
    steps: [],
    skills: [],
    pipelineContent: [],
    invalidReferences: [],
    issues: [],
    loadingPipelines: true,
    loadingSkills: true,
    synchronizingLibraries: false,
    processing: false,
    sourceContentMissing: !hasProcessSourceContent(normalizedCardId),
    metadataError: '',
    skillCatalogError: '',
    error: '',
    saveError: '',
    synchronizationMessage: '',
  });
  renderCardProcessModal();
  showProcessModal();
  telemetry('codex-card-process-modal-open', { cardId: normalizedCardId, mode: initialMode });
  const [library, skillCatalog] = await Promise.all([loadCodexPipelines(), loadCodexSkillsResult()]);
  if (generation !== processLoadGeneration || processModalState.cardId !== normalizedCardId) return;
  processModalState.loadingPipelines = false;
  processModalState.loadingSkills = false;
  processModalState.pipelineContent = [...library.availableContent];
  processModalState.skills = mergePipelinePromptsIntoSkillCatalog(skillCatalog.skills, library.availableContent);
  processModalState.skillCatalogError = skillCatalog.ok ? '' : skillCatalog.error || 'Could not load Codex skills.';
  if (library.ok) {
    processModalState.pipelines = library.pipelines;
    processModalState.steps = library.steps;
    processModalState.invalidReferences = library.invalidReferences;
    processModalState.issues = library.issues;
    processModalState.selectedPipelineId = library.pipelines.find(pipelineCanRun)?.id ?? library.pipelines[0]?.id ?? '';
  } else {
    processModalState.metadataError = library.error || 'Could not load saved pipelines.';
  }
  const firstDirectSkill = processModalState.skills[0];
  if (firstDirectSkill) selectProcessSkill(firstDirectSkill.name, false);
  renderCardProcessModal();
  processModal?.querySelector<HTMLInputElement>('.process-search')?.focus();
}

export function setCardProcessTab(mode: ProcessModalMode, restoreFocus = false): void {
  processModalState.mode = mode;
  processModalState.query = '';
  processModalState.selectedCategory = 'All';
  processModalState.error = '';
  renderCardProcessModal();
  if (restoreFocus) processModal?.querySelector<HTMLButtonElement>(`#process-tab-${mode}`)?.focus();
}

export function selectProcessPipeline(pipelineId: string): void {
  processModalState.selectedPipelineId = pipelineId;
  processModalState.error = '';
  renderCardProcessModal();
  processModal?.querySelector<HTMLButtonElement>(`[data-process-pipeline-id="${pipelineId}"]`)?.focus();
}

export function selectProcessSkill(skillName: string, rerender = true): void {
  const skill = processModalState.skills.find((entry) => entry.name === skillName);
  if (!skill) return;
  processModalState.selectedSkillName = skill.name;
  processModalState.codexModel = skill.effectiveCodexModel;
  processModalState.codexEffort = skill.effectiveCodexEffort;
  processModalState.codexModelExplicit = false;
  processModalState.codexEffortExplicit = false;
  processModalState.error = '';
  if (rerender) {
    renderCardProcessModal();
    processModal?.querySelector<HTMLButtonElement>(`[data-process-skill-name="${skillName}"]`)?.focus();
  }
  telemetry('codex-skill-selected', { cardId: processModalState.cardId, skillName });
}

export async function resynchronizeProcessLibraries(): Promise<boolean> {
  if (processModalState.synchronizingLibraries || !processModalState.cardId) return false;
  const generation = ++processLoadGeneration;
  const cardId = processModalState.cardId;
  const selectedPipelineId = processModalState.selectedPipelineId;
  const selectedSkillName = processModalState.selectedSkillName;
  processModalState.synchronizingLibraries = true;
  processModalState.loadingPipelines = true;
  processModalState.loadingSkills = true;
  processModalState.error = '';
  processModalState.synchronizationMessage = 'Synchronizing skills, then pipelines…';
  renderCardProcessModal();
  const synchronization = await requestFederatedLibrarySynchronization();
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  if (!synchronization.ok) {
    processModalState.synchronizingLibraries = false;
    processModalState.loadingPipelines = false;
    processModalState.loadingSkills = false;
    processModalState.synchronizationMessage = '';
    processModalState.error = synchronization.error || 'Could not synchronize federation libraries.';
    renderCardProcessModal();
    return false;
  }
  const [library, skillCatalog] = await Promise.all([loadCodexPipelines(), loadCodexSkillsResult()]);
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  processModalState.synchronizingLibraries = false;
  processModalState.loadingPipelines = false;
  processModalState.loadingSkills = false;
  processModalState.pipelineContent = [...library.availableContent];
  processModalState.skills = mergePipelinePromptsIntoSkillCatalog(skillCatalog.skills, library.availableContent);
  processModalState.skillCatalogError = skillCatalog.ok ? '' : skillCatalog.error || 'Could not load Codex skills.';
  processModalState.pipelines = library.pipelines;
  processModalState.steps = library.steps;
  processModalState.invalidReferences = library.invalidReferences;
  processModalState.issues = library.issues;
  processModalState.metadataError = library.ok ? '' : library.error || 'Could not load saved pipelines.';
  processModalState.selectedPipelineId = library.pipelines.find((pipeline) => pipeline.id === selectedPipelineId)?.id
    ?? library.pipelines.find(pipelineCanRun)?.id
    ?? library.pipelines[0]?.id
    ?? '';
  const nextSkill = processModalState.skills.find((skill) => skill.name === selectedSkillName) ?? processModalState.skills[0];
  if (nextSkill) selectProcessSkill(nextSkill.name, false);
  const peers = synchronization.synchronizedPeerCount;
  processModalState.synchronizationMessage = `Skills and pipelines synchronized with ${peers} online ${peers === 1 ? 'node' : 'nodes'}.`;
  renderCardProcessModal();
  return library.ok && skillCatalog.ok;
}

export async function runSelectedPipeline(): Promise<boolean> {
  const pipeline = selectedPipeline();
  const ledgerId = String(state.activeTab ?? '').trim();
  if (!pipeline || !ledgerId || processModalState.processing || !pipelineCanRun(pipeline) || processModalState.sourceContentMissing) return false;
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  processModalState.processing = true;
  processModalState.error = '';
  renderCardProcessModal();
  const result = await requestCodexPipelineRun({
    ledgerId,
    sourceCardId: cardId,
    pipelineId: pipeline.id,
    requestId: createExecutionRequestId('pipeline'),
  });
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  processModalState.processing = false;
  if (!result.ok) {
    processModalState.error = result.error || 'Could not start this pipeline.';
    renderCardProcessModal();
    return false;
  }
  await refreshRuntimeState();
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  telemetry('codex-pipeline-run-started', { cardId, pipelineId: pipeline.id, runId: result.run?.id ?? '', queuePosition: result.queuePosition ?? 0 });
  closeCardProcessModal();
  return true;
}

export async function processSelectedCardSkill(): Promise<boolean> {
  const skill = selectedSkill();
  if (!skill || processModalState.processing || processModalState.sourceContentMissing) return false;
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  const codexModel = processModalState.codexModel;
  const codexEffort = processModalState.codexEffort;
  const codexModelExplicit = processModalState.codexModelExplicit;
  const codexEffortExplicit = processModalState.codexEffortExplicit;
  processModalState.processing = true;
  processModalState.error = '';
  renderCardProcessModal();
  const ok = await processCardSkillController({
    cardId,
    skillName: skill.name,
    contentKind: directContentKind(skill),
    codexModel: codexModelExplicit ? codexModel : undefined,
    codexEffort: codexEffortExplicit ? codexEffort : undefined,
  });
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  processModalState.processing = false;
  if (!ok) {
    processModalState.error = 'Could not start this skill. Check the active run and try again.';
    renderCardProcessModal();
    return false;
  }
  closeCardProcessModal();
  window.location.assign(controlRoomPath('exec'));
  return true;
}

export function editProcessPipeline(): void {
  const pipeline = selectedPipeline();
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  void openPipelineEditor({
    pipeline,
    steps: processModalState.steps,
    ...(processModalState.metadataError ? {} : {
      skills: processModalState.pipelineContent,
    }),
    invalidReferences: pipeline ? pipelineReferences(pipeline.id) : [],
    onSaved: (result) => {
      if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
      processModalState.pipelines = result.pipelines;
      processModalState.steps = result.steps;
      processModalState.invalidReferences = result.invalidReferences;
      processModalState.issues = result.issues;
      processModalState.selectedPipelineId = result.pipeline?.id ?? processModalState.selectedPipelineId;
      processModalState.saveError = '';
      renderCardProcessModal();
    },
    onSaveError: (message) => {
      if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
      processModalState.saveError = `Pipeline save failed: ${message}`;
      renderCardProcessModal();
    },
  });
}

export async function reloadProcessSkills(): Promise<void> {
  const generation = ++processLoadGeneration;
  const cardId = processModalState.cardId;
  processModalState.loadingSkills = true;
  renderCardProcessModal();
  const [result, library] = await Promise.all([loadCodexSkillsResult(), loadCodexPipelines()]);
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
  const selectedName = processModalState.selectedSkillName;
  if (library.ok) processModalState.pipelineContent = [...library.availableContent];
  processModalState.skills = mergePipelinePromptsIntoSkillCatalog(result.skills, library.ok ? library.availableContent : processModalState.pipelineContent);
  processModalState.skillCatalogError = result.ok ? '' : result.error || 'Could not load Codex skills.';
  processModalState.loadingSkills = false;
  const nextSelection = processModalState.skills.find((skill) => skill.name === selectedName) ?? processModalState.skills[0];
  if (nextSelection) selectProcessSkill(nextSelection.name, false);
  renderCardProcessModal();
}

export function closeCardProcessModal(): void {
  processLoadGeneration += 1;
  processModal?.close?.();
}
