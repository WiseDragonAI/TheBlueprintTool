/**
 * WHAT: Renders the saved reusable-pipeline library.
 * WHY: Operators need one place to inspect ordered steps and open create/edit flows.
 */
import type {
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { pipelinesModal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { loadCodexPipelines } from './load-codex-pipelines.js';
import { openPipelineEditor } from './render-pipeline-editor-modal.js';
import type { CodexPipelineSaveResult } from './request-codex-pipeline-save.js';

export type PipelineLibraryState = {
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  invalidReferences: readonly CodexPipelineInvalidReference[];
  issues: readonly CodexPipelineStoreIssue[];
  expandedPipelineId: string;
  loading: boolean;
  error: string;
  onLibraryChanged?: (result: CodexPipelineSaveResult) => void | Promise<void>;
};

export const pipelineLibraryState: PipelineLibraryState = {
  pipelines: [],
  steps: [],
  invalidReferences: [],
  issues: [],
  expandedPipelineId: '',
  loading: false,
  error: '',
};

let libraryLoadGeneration = 0;

function showLibrary(): void {
  if (!pipelinesModal?.open) pipelinesModal?.showModal?.();
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

function referencesForPipeline(pipelineId: string): readonly CodexPipelineInvalidReference[] {
  return pipelineLibraryState.invalidReferences.filter((reference) => reference.pipelineId === pipelineId);
}

function stepMap(): Map<string, CodexPipelineStep> {
  return new Map(pipelineLibraryState.steps.map((step) => [step.id, step]));
}

function openEditorForPipeline(pipeline?: CodexPipeline): void {
  const onLibraryChanged = pipelineLibraryState.onLibraryChanged;
  void openPipelineEditor({
    pipeline,
    steps: pipelineLibraryState.steps,
    invalidReferences: pipeline ? referencesForPipeline(pipeline.id) : [],
    onSaved: async (result) => {
      pipelineLibraryState.pipelines = result.pipelines;
      pipelineLibraryState.steps = result.steps;
      pipelineLibraryState.invalidReferences = result.invalidReferences;
      pipelineLibraryState.issues = result.issues;
      pipelineLibraryState.expandedPipelineId = result.pipeline?.id ?? pipelineLibraryState.expandedPipelineId;
      pipelineLibraryState.error = '';
      await onLibraryChanged?.(result);
      renderPipelinesModal();
    },
    onSaveError: (message) => {
      pipelineLibraryState.error = `Pipeline save failed: ${message}`;
      renderPipelinesModal();
    },
  });
}

function renderStepPreview(pipeline: CodexPipeline): HTMLOListElement {
  const stepsById = stepMap();
  const list = document.createElement('ol');
  list.className = 'pipeline-step-preview';
  list.setAttribute('aria-label', `${pipeline.name} steps`);
  pipeline.stepIds.forEach((stepId, index) => {
    const item = document.createElement('li');
    const step = stepsById.get(stepId);
    if (!step) {
      item.className = 'is-invalid';
      const missing = document.createElement('span');
      missing.className = 'pipeline-preview-step-name';
      missing.textContent = `${index + 1}. Missing step (${stepId})`;
      const warning = document.createElement('span');
      warning.className = 'pipeline-preview-skills';
      warning.textContent = 'Edit this pipeline to repair the reference.';
      item.replaceChildren(missing, warning);
    } else {
      const name = document.createElement('span');
      name.className = 'pipeline-preview-step-name';
      name.textContent = `${index + 1}. ${step.name}`;
      const skills = document.createElement('span');
      skills.className = 'pipeline-preview-skills';
      skills.textContent = step.skills.length > 0
        ? step.skills.map((skill) => skill.skillName).join(' · ')
        : 'No configured skills';
      item.replaceChildren(name, skills);
    }
    list.append(item);
  });
  if (pipeline.stepIds.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'is-invalid';
    empty.textContent = 'This pipeline has no steps.';
    list.append(empty);
  }
  return list;
}

function renderPipelineRow(pipeline: CodexPipeline): HTMLElement {
  const expanded = pipeline.id === pipelineLibraryState.expandedPipelineId;
  const invalidReferences = referencesForPipeline(pipeline.id);
  const row = document.createElement('article');
  row.className = `pipeline-library-row${expanded ? ' is-expanded' : ''}${invalidReferences.length ? ' has-warning' : ''}`;
  row.dataset.pipelineId = pipeline.id;
  const summary = document.createElement('div');
  summary.className = 'pipeline-library-summary';
  const expand = button(expanded ? '⌄' : '›', () => togglePipelineExpanded(pipeline.id), 'pipeline-expand-button', `pipeline-expand:${pipeline.id}`);
  expand.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${pipeline.name}`);
  expand.setAttribute('aria-expanded', String(expanded));
  const copy = document.createElement('div');
  copy.className = 'pipeline-library-copy';
  const title = document.createElement('h3');
  title.textContent = pipeline.name;
  const purpose = document.createElement('p');
  purpose.textContent = pipeline.purpose || `${pipeline.stepIds.length} reusable step${pipeline.stepIds.length === 1 ? '' : 's'}`;
  copy.replaceChildren(title, purpose);
  if (invalidReferences.length > 0) {
    const warning = document.createElement('span');
    warning.className = 'pipeline-reference-badge';
    warning.textContent = `${invalidReferences.length} invalid reference${invalidReferences.length === 1 ? '' : 's'}`;
    copy.append(warning);
  }
  const edit = button('Edit pipeline', () => openEditorForPipeline(pipeline), 'ghost-button', `pipeline-edit:${pipeline.id}`);
  summary.replaceChildren(expand, copy, edit);
  row.replaceChildren(summary, ...(expanded ? [renderStepPreview(pipeline)] : []));
  return row;
}

export function renderPipelinesModal(): void {
  if (!pipelinesModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  pipelinesModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Reusable automation';
  const title = document.createElement('h2');
  title.id = 'pipelines-modal-title';
  title.textContent = 'Pipelines';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Create a pipeline, expand one to inspect its ordered steps, or edit it.';
  copy.replaceChildren(kicker, title, subtitle);
  const actions = document.createElement('div');
  actions.className = 'codex-head-actions';
  actions.replaceChildren(
    button('New pipeline', () => openEditorForPipeline(), 'primary-action', 'pipeline-library-new'),
    button('×', closePipelinesModal, 'plain-close', 'pipeline-library-close'),
  );
  actions.lastElementChild?.setAttribute('aria-label', 'Close pipelines');
  head.replaceChildren(copy, actions);

  const content = document.createElement('section');
  content.className = 'pipeline-library-list';
  content.setAttribute('aria-label', 'Saved pipelines');
  if (pipelineLibraryState.loading) {
    const loading = document.createElement('p');
    loading.className = 'codex-empty-state';
    loading.textContent = 'Loading saved pipelines…';
    content.replaceChildren(loading);
  } else if (pipelineLibraryState.error) {
    const error = document.createElement('div');
    error.className = 'codex-empty-state is-error';
    const message = document.createElement('p');
    message.textContent = pipelineLibraryState.error;
    error.replaceChildren(message, button('Try again', () => { void refreshPipelinesModal(); }, 'ghost-button', 'pipeline-library-retry'));
    content.replaceChildren(error);
  } else if (pipelineLibraryState.pipelines.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'codex-empty-state';
    const message = document.createElement('p');
    message.textContent = 'No saved pipelines yet.';
    const description = document.createElement('p');
    description.textContent = 'Create the first reusable sequence of step skills for this workspace.';
    empty.replaceChildren(message, description, button('Create pipeline', () => openEditorForPipeline(), 'primary-action', 'pipeline-library-create'));
    content.replaceChildren(empty);
  } else {
    content.replaceChildren(...pipelineLibraryState.pipelines.map(renderPipelineRow));
  }

  const footer = document.createElement('footer');
  footer.className = 'codex-modal-actions pipeline-library-footer';
  const issueCount = pipelineLibraryState.invalidReferences.length + pipelineLibraryState.issues.length;
  const status = document.createElement('p');
  status.className = issueCount > 0 ? 'codex-inline-warning' : 'codex-form-notice';
  status.textContent = issueCount > 0
    ? `${issueCount} library warning${issueCount === 1 ? '' : 's'} detected. Expand and edit affected pipelines.`
    : `${pipelineLibraryState.pipelines.length} saved pipeline${pipelineLibraryState.pipelines.length === 1 ? '' : 's'}`;
  footer.replaceChildren(status, button('Close', closePipelinesModal));
  pipelinesModal.replaceChildren(head, content, footer);
  if (focusKey) {
    const nextFocus = pipelinesModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
    else pipelinesModal.focus();
  }
}

export async function openPipelinesModal(input: { onLibraryChanged?: PipelineLibraryState['onLibraryChanged'] } = {}): Promise<void> {
  pipelineLibraryState.onLibraryChanged = input.onLibraryChanged;
  pipelineLibraryState.loading = true;
  pipelineLibraryState.error = '';
  renderPipelinesModal();
  showLibrary();
  telemetry('codex-pipelines-modal-open', {});
  await refreshPipelinesModal();
}

export async function refreshPipelinesModal(): Promise<void> {
  const generation = ++libraryLoadGeneration;
  pipelineLibraryState.loading = true;
  pipelineLibraryState.error = '';
  renderPipelinesModal();
  const result = await loadCodexPipelines();
  if (generation !== libraryLoadGeneration) return;
  pipelineLibraryState.loading = false;
  if (!result.ok) {
    pipelineLibraryState.error = result.error || 'Could not load saved pipelines.';
    renderPipelinesModal();
    return;
  }
  pipelineLibraryState.pipelines = result.pipelines;
  pipelineLibraryState.steps = result.steps;
  pipelineLibraryState.invalidReferences = result.invalidReferences;
  pipelineLibraryState.issues = result.issues;
  if (!result.pipelines.some((pipeline) => pipeline.id === pipelineLibraryState.expandedPipelineId)) {
    pipelineLibraryState.expandedPipelineId = result.pipelines[0]?.id ?? '';
  }
  renderPipelinesModal();
}

export function togglePipelineExpanded(pipelineId: string): void {
  pipelineLibraryState.expandedPipelineId = pipelineLibraryState.expandedPipelineId === pipelineId ? '' : pipelineId;
  renderPipelinesModal();
}

export function closePipelinesModal(): void {
  libraryLoadGeneration += 1;
  pipelinesModal?.close?.();
}
