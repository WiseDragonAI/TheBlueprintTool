/**
 * WHAT: Reuses the responsive project settings contract from the desktop projects canvas.
 * WHY: Project metadata must have one persistence path while each surface owns its runtime state.
 */
import { projectColorPickerModal, projectSettingsModal } from '../../dom.js';
import { state } from '../../state.js';
import { enterProjectsCanvasController } from '../../navigation/controller/enter-projects-canvas-controller.js';
import { committedProjectColor, hexToHsv, hsvToHex, projectColorPickerGradients } from '../../../app/responsive/project-color-picker.js';
import { projectSettingsValues, saveProjectSettingsRequest } from '../../../app/responsive/project-settings.js';

type ProjectCard = {
  targetProjectId?: string;
  title?: string;
  description?: string;
  color?: string;
};

type SliderElement = HTMLElement & {
  noUiSlider: {
    get(): string | number;
    set(value: string | number): void;
    on(event: string, listener: () => void): void;
  };
};

const form = projectSettingsModal?.querySelector<HTMLFormElement>('.project-settings-form');
const nameInput = projectSettingsModal?.querySelector<HTMLInputElement>('.project-settings-name');
const descriptionInput = projectSettingsModal?.querySelector<HTMLTextAreaElement>('.project-settings-description');
const colorInput = projectSettingsModal?.querySelector<HTMLInputElement>('.project-settings-color');
const colorTrigger = projectSettingsModal?.querySelector<HTMLButtonElement>('.project-settings-color-trigger');
const colorValue = projectSettingsModal?.querySelector<HTMLElement>('.project-settings-color-value');
const errorMessage = projectSettingsModal?.querySelector<HTMLElement>('.project-settings-error');
const saveButton = projectSettingsModal?.querySelector<HTMLButtonElement>('.project-settings-save');
const sliders = {
  hue: projectColorPickerModal?.querySelector<SliderElement>('.project-color-hue'),
  saturation: projectColorPickerModal?.querySelector<SliderElement>('.project-color-saturation'),
  value: projectColorPickerModal?.querySelector<SliderElement>('.project-color-value'),
};

let activeProjectId = '';
let originalColor = '';
let colorDirty = false;
let initialized = false;

function projectCard(projectId: string): ProjectCard | undefined {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as ProjectCard[] : [];
  return cards.find((card) => String(card.targetProjectId ?? '') === projectId);
}

function projectFromCard(projectId: string, card: ProjectCard): Record<string, unknown> {
  return {
    id: projectId,
    name: String(card.title ?? ''),
    description: String(card.description ?? ''),
    color: String(card.color ?? ''),
  };
}

function currentHsv(): { hue: number; saturation: number; value: number } {
  return {
    hue: Number(sliders.hue?.noUiSlider.get() ?? 0),
    saturation: Number(sliders.saturation?.noUiSlider.get() ?? 0),
    value: Number(sliders.value?.noUiSlider.get() ?? 0),
  };
}

function renderColorPicker(): void {
  if (!projectColorPickerModal || !sliders.hue || !sliders.saturation || !sliders.value) return;
  const hsv = currentHsv();
  const gradients = projectColorPickerGradients(hsv);
  sliders.hue.style.background = gradients.hue;
  sliders.saturation.style.background = gradients.saturation;
  sliders.value.style.background = gradients.value;
  projectColorPickerModal.style.setProperty('--project-color-picker-color', hsvToHex(hsv));
}

function renderColorField(color: string): void {
  const normalized = color.toLowerCase();
  colorTrigger?.style.setProperty('--project-settings-color', normalized);
  if (colorValue) colorValue.textContent = normalized;
}

function closeColorPicker(): void {
  projectColorPickerModal?.close();
  requestAnimationFrame(() => colorTrigger?.focus());
}

function openColorPicker(): void {
  if (!colorInput || !sliders.hue || !sliders.saturation || !sliders.value) return;
  originalColor = colorInput.value;
  colorDirty = false;
  const hsv = hexToHsv(originalColor);
  sliders.hue.noUiSlider.set(hsv.hue);
  sliders.saturation.noUiSlider.set(hsv.saturation);
  sliders.value.noUiSlider.set(hsv.value);
  renderColorPicker();
  projectColorPickerModal?.showModal();
  requestAnimationFrame(() => sliders.hue?.querySelector<HTMLElement>('[role="slider"]')?.focus());
}

async function submitProjectSettings(): Promise<void> {
  const card = projectCard(activeProjectId);
  if (!card || !form?.reportValidity() || !nameInput || !descriptionInput || !colorInput || !saveButton || !errorMessage) return;
  const project = projectFromCard(activeProjectId, card);
  saveButton.disabled = true;
  saveButton.setAttribute('aria-busy', 'true');
  projectSettingsModal.dataset.busy = 'true';
  errorMessage.hidden = true;
  try {
    const result = await saveProjectSettingsRequest({
      fetchImpl: fetch,
      projects: [project],
      projectId: activeProjectId,
      values: { name: nameInput.value, description: descriptionInput.value, color: colorInput.value },
    });
    projectSettingsModal.close();
    await enterProjectsCanvasController({ replace: true });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.project-card-settings-toggle[data-project-id="${CSS.escape(String(result.project.id))}"]`)?.focus());
  } catch (cause) {
    errorMessage.textContent = cause instanceof Error ? cause.message : 'Project update failed.';
    errorMessage.hidden = false;
  } finally {
    delete projectSettingsModal.dataset.busy;
    saveButton.disabled = false;
    saveButton.removeAttribute('aria-busy');
  }
}

function initialize(): void {
  if (initialized || !projectSettingsModal || !projectColorPickerModal || !form) return;
  const noUiSlider = (window as unknown as { noUiSlider?: { create(element: HTMLElement, options: Record<string, unknown>): void } }).noUiSlider;
  if (!noUiSlider || !sliders.hue || !sliders.saturation || !sliders.value) throw new Error('Project color picker is unavailable.');
  const createSlider = (element: SliderElement, start: number, maximum: number): void => {
    noUiSlider.create(element, {
      start,
      step: 1,
      connect: false,
      range: { min: 0, max: maximum },
      keyboardSupport: true,
      ariaFormat: { to: (value: number) => String(Math.round(value)), from: (value: string) => Number(value) },
    });
    element.querySelector('[role="slider"]')?.setAttribute('aria-labelledby', element.getAttribute('aria-labelledby') ?? '');
  };
  createSlider(sliders.hue, 0, 360);
  createSlider(sliders.saturation, 70, 100);
  createSlider(sliders.value, 80, 100);
  for (const slider of Object.values(sliders) as SliderElement[]) {
    slider.noUiSlider.on('update', renderColorPicker);
    for (const event of ['start', 'slide', 'change']) slider.noUiSlider.on(event, () => { colorDirty = true; });
  }
  colorTrigger?.addEventListener('click', openColorPicker);
  projectColorPickerModal.querySelector('.project-color-picker-cancel')?.addEventListener('click', closeColorPicker);
  projectColorPickerModal.querySelector('.project-color-picker-set')?.addEventListener('click', () => {
    if (!colorInput) return;
    const color = committedProjectColor(originalColor, currentHsv(), colorDirty);
    colorInput.value = color;
    renderColorField(color);
    closeColorPicker();
  });
  projectColorPickerModal.addEventListener('cancel', (event) => { event.preventDefault(); closeColorPicker(); });
  projectSettingsModal.querySelector('.project-settings-cancel')?.addEventListener('click', () => {
    if (!projectSettingsModal.dataset.busy) projectSettingsModal.close();
  });
  projectSettingsModal.addEventListener('cancel', (event) => { if (saveButton?.disabled) event.preventDefault(); });
  form.addEventListener('submit', (event) => { event.preventDefault(); void submitProjectSettings(); });
  initialized = true;
}

export function openProjectSettingsModal(projectId: string): boolean {
  initialize();
  const card = projectCard(projectId);
  if (!card || !nameInput || !descriptionInput || !colorInput || !errorMessage) return false;
  activeProjectId = projectId;
  const values = projectSettingsValues(projectFromCard(projectId, card));
  nameInput.value = values.name;
  descriptionInput.value = values.description;
  colorInput.value = values.color;
  renderColorField(values.color);
  errorMessage.hidden = true;
  projectSettingsModal.showModal();
  nameInput.focus();
  return true;
}
