/**
 * WHAT: Owns ordering and colored-label decoration for every skill-library surface.
 * WHY: Desktop and mobile must present the same favorite and category semantics.
 */
import { colorForSkillCategory, type SkillCategory } from './skill-category.js';

export type FavoriteSkill = { name: string; favorite?: boolean };

export function compareFavoriteSkills(left: FavoriteSkill, right: FavoriteSkill): number {
  const favoriteOrder = Number(right.favorite === true) - Number(left.favorite === true);
  return favoriteOrder || left.name.localeCompare(right.name);
}

export function sortSkillsByFavorite<T extends FavoriteSkill>(skills: readonly T[]): T[] {
  return [...skills].sort(compareFavoriteSkills);
}

export function decorateSkillCategoryLabel(element: HTMLElement, category: SkillCategory | 'All'): void {
  if (!element.className.split(/\s+/).includes('skill-category-label')) element.className = `${element.className} skill-category-label`.trim();
  element.style.setProperty('--skill-category-color', colorForSkillCategory(category));
}
