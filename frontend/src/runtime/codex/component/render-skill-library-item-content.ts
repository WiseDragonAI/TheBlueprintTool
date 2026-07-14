/**
 * WHAT: Renders the semantic content shared by desktop and mobile skill-library rows.
 * WHY: Library identity, colored categories, project labels, source, and favorite state must not drift by viewport.
 */
import { colorForSkillTag, decorateSkillCategoryLabel, tagsForSkill } from '../helper/skill-library-presentation.js';

export type SkillLibraryItem = {
  name: string;
  description?: string;
  favorite?: boolean;
  tags?: readonly string[];
};

export function renderSkillLibraryItemContent(skill: SkillLibraryItem): HTMLElement[] {
  const tags = tagsForSkill(skill);
  const name = document.createElement('strong');
  name.className = 'skill-result-name skill-result-heading';
  name.textContent = skill.name;
  name.style.setProperty('--skill-category-color', colorForSkillTag(tags[0]));
  if (skill.favorite) {
    const favorite = document.createElement('span');
    favorite.className = 'skill-favorite-star';
    favorite.setAttribute('aria-label', 'Favorite');
    favorite.textContent = '★';
    name.append(favorite);
  }

  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = skill.description || 'No description.';

  const labels = document.createElement('span');
  labels.className = 'codex-list-labels process-result-metadata';
  for (const tag of tags) {
    const label = document.createElement('small');
    label.textContent = tag;
    decorateSkillCategoryLabel(label, tag);
    labels.append(label);
  }
  return [name, description, labels];
}
