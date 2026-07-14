/**
 * WHAT: Renders the semantic content shared by desktop and mobile skill-library rows.
 * WHY: Library identity, colored categories, project labels, source, and favorite state must not drift by viewport.
 */
import { categoryForSkill } from '../helper/skill-category.js';
import { decorateSkillCategoryLabel } from '../helper/skill-library-presentation.js';

export type SkillLibraryItemProject = { name: string; color?: string };
export type SkillLibraryItem = {
  name: string;
  description?: string;
  source?: string;
  favorite?: boolean;
};

export function renderSkillLibraryItemContent(skill: SkillLibraryItem, projects: readonly SkillLibraryItemProject[] = []): HTMLElement[] {
  const category = categoryForSkill(skill.name);
  const head = document.createElement('span');
  head.className = 'skill-result-header';
  const name = document.createElement('strong');
  name.className = 'skill-result-name';
  name.textContent = skill.name;
  const categoryLabel = document.createElement('small');
  categoryLabel.className = 'skill-result-category';
  categoryLabel.textContent = category;
  decorateSkillCategoryLabel(categoryLabel, category);
  head.replaceChildren(name, categoryLabel);

  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = skill.description || 'No description.';

  const labels = document.createElement('span');
  labels.className = 'codex-list-labels process-result-metadata';
  for (const project of projects) {
    const label = document.createElement('small');
    label.className = 'project-record-label';
    label.textContent = project.name;
    if (project.color) label.style.setProperty('--project-color', project.color);
    labels.append(label);
  }
  const source = document.createElement('small');
  source.className = 'skill-source-label';
  source.textContent = skill.source || 'skill';
  labels.append(source);
  if (skill.favorite === true) {
    const favorite = document.createElement('small');
    favorite.className = 'skill-favorite-label';
    favorite.textContent = 'Favorite';
    labels.append(favorite);
  }
  return [head, description, labels];
}
