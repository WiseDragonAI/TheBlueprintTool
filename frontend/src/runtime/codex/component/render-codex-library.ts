/**
 * WHAT: Owns the searchable, project-aware, tag-aware catalog shared by every Codex library surface.
 * WHY: Skill and pipeline callers differ only in row presentation and the action performed after selection.
 */
import { decorateSkillCategoryLabel } from '../helper/skill-library-presentation.js';

export type CodexLibraryProject = { id: string; name: string; color?: string };

export type CodexLibraryRecord = {
  id: string;
  name: string;
  description?: string;
  favorite?: boolean;
  tags?: readonly string[];
  projects?: readonly CodexLibraryProject[];
  searchText?: string;
};

export type CodexLibraryFilterState = {
  query: string;
  projectId: string;
  tag: string;
};

export type CodexLibraryRenderInput<T extends CodexLibraryRecord> = {
  records: readonly T[];
  projects: readonly CodexLibraryProject[];
  filters: CodexLibraryFilterState;
  controlsHost: HTMLElement;
  resultsHost: HTMLElement;
  selectedId?: string;
  showProjects?: boolean;
  favoriteFirst?: boolean;
  emptyMessage: string;
  resultCountLabel: string;
  synchronizing?: boolean;
  onSynchronize?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  renderRecord: (record: T, selected: boolean) => HTMLElement;
  onFiltersChanged: (filters: CodexLibraryFilterState) => void;
};

function recordTags(record: CodexLibraryRecord): readonly string[] {
  return Array.isArray(record.tags) ? record.tags : [];
}

export function visibleCodexLibraryRecords<T extends CodexLibraryRecord>(
  records: readonly T[],
  filters: CodexLibraryFilterState,
  favoriteFirst = false,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return records
    .filter((record) => {
      const projects = Array.isArray(record.projects) ? record.projects : [];
      const tags = recordTags(record);
      if (filters.projectId !== 'All' && !projects.some((project) => project.id === filters.projectId)) return false;
      if (filters.tag !== 'All' && !tags.includes(filters.tag)) return false;
      const searchable = [
        record.name,
        record.description ?? '',
        record.searchText ?? '',
        ...projects.map((project) => project.name),
        ...tags,
      ].join(' ').toLowerCase();
      return !query || searchable.includes(query);
    })
    .sort((left, right) => {
      const favoriteOrder = favoriteFirst ? Number(right.favorite === true) - Number(left.favorite === true) : 0;
      return favoriteOrder || left.name.localeCompare(right.name);
    });
}

function filterButton(
  label: string,
  selected: boolean,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.setAttribute('aria-pressed', String(selected));
  button.addEventListener('click', onClick);
  return button;
}

function availableProjects<T extends CodexLibraryRecord>(records: readonly T[], projects: readonly CodexLibraryProject[]): CodexLibraryProject[] {
  return projects.filter((project) => records.some((record) => record.projects?.some((candidate) => candidate.id === project.id)));
}

function availableTags<T extends CodexLibraryRecord>(records: readonly T[]): string[] {
  return [...new Set(records.flatMap((record) => [...recordTags(record)]))].sort((left, right) => left.localeCompare(right));
}

export function renderCodexLibrary<T extends CodexLibraryRecord>(input: CodexLibraryRenderInput<T>): T[] {
  input.controlsHost.classList.add('codex-control-rail');
  const projects = availableProjects(input.records, input.projects);
  const tags = availableTags(input.records);
  const filters: CodexLibraryFilterState = {
    query: input.filters.query,
    projectId: input.showProjects && projects.some((project) => project.id === input.filters.projectId) ? input.filters.projectId : 'All',
    tag: tags.includes(input.filters.tag) ? input.filters.tag : 'All',
  };
  const update = (patch: Partial<CodexLibraryFilterState>) => input.onFiltersChanged({ ...filters, ...patch });

  const mountedSearch = input.controlsHost.querySelector<HTMLInputElement>('.codex-library-query');
  const mountedSearchLabel = mountedSearch?.parentElement?.classList.contains('codex-library-search')
    ? mountedSearch.parentElement as HTMLLabelElement
    : undefined;
  const searchLabel = mountedSearchLabel ?? document.createElement('label');
  const search = mountedSearch ?? document.createElement('input');
  if (!mountedSearchLabel) {
    searchLabel.className = 'codex-library-search';
    const searchIcon = document.createElement('span');
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.textContent = '⌕';
    searchLabel.replaceChildren(searchIcon, search);
  }
  if (!mountedSearch) search.className = 'codex-library-query';
  search.type = 'search';
  search.placeholder = 'Search library';
  search.setAttribute('aria-label', 'Search library');
  search.dataset.codexFocusKey = 'codex-library-query';
  if (search.value !== filters.query) search.value = filters.query;
  search.oninput = () => update({ query: search.value });

  const filterToggle = document.createElement('button');
  filterToggle.type = 'button';
  filterToggle.className = 'codex-mobile-filter-toggle';
  const activeFilterCount = Number(filters.projectId !== 'All') + Number(filters.tag !== 'All');
  filterToggle.textContent = activeFilterCount ? `Filters · ${activeFilterCount}` : 'Filters';
  filterToggle.setAttribute('aria-expanded', String(input.controlsHost.dataset.mobileFiltersOpen === 'true'));
  filterToggle.addEventListener('click', () => {
    const open = input.controlsHost.dataset.mobileFiltersOpen !== 'true';
    input.controlsHost.dataset.mobileFiltersOpen = String(open);
    input.controlsHost.classList?.toggle?.('mobile-filters-open', open);
    filterToggle.setAttribute('aria-expanded', String(open));
  });
  const filterPanel = document.createElement('aside');
  filterPanel.className = 'codex-library-filter-panel codex-side-panel codex-control-rail';
  filterPanel.setAttribute('aria-label', 'Library filters');
  const filterPanelHead = document.createElement('header');
  filterPanelHead.className = 'skill-workspace-rail-header';
  const filterPanelTitle = document.createElement('h3');
  filterPanelTitle.textContent = 'Filters';
  const filterPanelClose = filterButton('×', false, 'plain-close codex-library-filter-close', () => {
    input.controlsHost.dataset.mobileFiltersOpen = 'false';
    input.controlsHost.classList?.remove?.('mobile-filters-open');
    filterToggle.setAttribute('aria-expanded', 'false');
  });
  filterPanelClose.setAttribute('aria-label', 'Close filters');
  filterPanelHead.append(filterPanelTitle, filterPanelClose);
  const filterBackdrop = filterButton('', false, 'codex-library-filter-backdrop codex-side-panel-backdrop', () => {
    input.controlsHost.dataset.mobileFiltersOpen = 'false';
    input.controlsHost.classList?.remove?.('mobile-filters-open');
    filterToggle.setAttribute('aria-expanded', 'false');
  });
  filterBackdrop.setAttribute('aria-label', 'Close filters');

  const projectFilters = document.createElement('div');
  projectFilters.className = 'codex-filter-row codex-library-project-filters';
  projectFilters.setAttribute('aria-label', 'Filter library by project');
  projectFilters.hidden = !input.showProjects;
  if (input.showProjects) {
    const all = filterButton('All projects', filters.projectId === 'All', 'project-filter-chip', () => update({ projectId: 'All' }));
    all.style.setProperty('--project-color', '#20242b');
    projectFilters.append(all);
    for (const project of projects) {
      const chip = filterButton(project.name, filters.projectId === project.id, 'project-filter-chip', () => update({ projectId: project.id }));
      chip.style.setProperty('--project-color', project.color || '#20242b');
      projectFilters.append(chip);
    }
  }

  const tagFilters = document.createElement('div');
  tagFilters.className = 'codex-filter-row codex-library-tag-filters';
  tagFilters.setAttribute('aria-label', 'Filter library by tag');
  const allTags = filterButton('All tags', filters.tag === 'All', 'skill-category-filter', () => update({ tag: 'All' }));
  decorateSkillCategoryLabel(allTags, 'All');
  tagFilters.append(allTags);
  for (const tag of tags) {
    const chip = filterButton(tag, filters.tag === tag, 'skill-category-filter', () => update({ tag }));
    decorateSkillCategoryLabel(chip, tag);
    tagFilters.append(chip);
  }

  const clear = filterButton('Clear filters', false, 'codex-filter-clear', () => input.onFiltersChanged({ query: '', projectId: 'All', tag: 'All' }));
  const actions = document.createElement('div');
  actions.className = 'codex-library-control-actions';
  if (input.onCreate) {
    actions.append(filterButton(input.createLabel ?? 'New', false, 'primary-button codex-library-create', input.onCreate));
  }
  if (input.onSynchronize) {
    const synchronize = filterButton(input.synchronizing ? 'Synchronizing…' : 'Resynchronize', false, 'codex-secondary codex-library-synchronize', input.onSynchronize);
    synchronize.disabled = input.synchronizing === true;
    actions.append(synchronize);
  }
  actions.append(clear);
  const filterPanelBody = document.createElement('div');
  filterPanelBody.className = 'skill-workspace-rail-body';
  filterPanelBody.append(searchLabel, projectFilters, tagFilters);
  const filterPanelFooter = document.createElement('footer');
  filterPanelFooter.className = 'skill-workspace-rail-footer';
  filterPanelFooter.append(actions);
  if (mountedSearchLabel) {
    filterPanel.replaceChildren(filterPanelHead, filterPanelBody, filterPanelFooter);
    input.controlsHost.append(filterToggle, filterBackdrop, filterPanel);
  } else {
    filterPanel.replaceChildren(filterPanelHead, filterPanelBody, filterPanelFooter);
    input.controlsHost.replaceChildren(filterToggle, filterBackdrop, filterPanel);
  }
  input.controlsHost.classList?.toggle?.('mobile-filters-open', input.controlsHost.dataset.mobileFiltersOpen === 'true');

  const visible = visibleCodexLibraryRecords(input.records, filters, input.favoriteFirst);
  if (visible.length) input.resultsHost.replaceChildren(...visible.map((record) => input.renderRecord(record, record.id === input.selectedId)));
  else {
    const empty = document.createElement('p');
    empty.className = 'codex-message codex-library-empty';
    empty.textContent = input.emptyMessage;
    input.resultsHost.replaceChildren(empty);
  }
  input.resultsHost.dataset.resultCount = String(visible.length);
  input.resultsHost.setAttribute('aria-label', `${visible.length} ${input.resultCountLabel}`);
  return visible;
}
