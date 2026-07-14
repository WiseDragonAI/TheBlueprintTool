/**
 * WHAT: Owns ordering and colored-label decoration for every skill-library surface.
 * WHY: Desktop and mobile must present the same favorite and category semantics.
 */
import { categoryForSkill, colorForSkillCategory, skillCategories, type SkillCategory } from './skill-category.js';

export type FavoriteSkill = { name: string; favorite?: boolean };
export type TaggedSkill = { name: string; tags?: readonly string[] };

const customTagColors = ['#38d9e8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#f97316'];

export function tagsForSkill(skill: TaggedSkill): string[] {
  const tags = Array.isArray(skill.tags) ? [...new Set(skill.tags.map((tag) => String(tag).trim()).filter(Boolean))] : [];
  return tags.length ? tags : [categoryForSkill(skill.name)];
}

export function colorForSkillTag(tag: string): string {
  const normalized = tag.trim() || 'Uncategorized';
  if (normalized === 'Uncategorized' || skillCategories.includes(normalized as typeof skillCategories[number])) {
    return colorForSkillCategory(normalized as SkillCategory);
  }
  let hash = 0;
  for (const character of normalized) hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
  return customTagColors[Math.abs(hash) % customTagColors.length];
}

export function compareFavoriteSkills(left: FavoriteSkill, right: FavoriteSkill): number {
  const favoriteOrder = Number(right.favorite === true) - Number(left.favorite === true);
  return favoriteOrder || left.name.localeCompare(right.name);
}

export function sortSkillsByFavorite<T extends FavoriteSkill>(skills: readonly T[]): T[] {
  return [...skills].sort(compareFavoriteSkills);
}

export function decorateSkillCategoryLabel(element: HTMLElement, category: string): void {
  if (!element.className.split(/\s+/).includes('skill-category-label')) element.className = `${element.className} skill-category-label`.trim();
  element.style.setProperty('--skill-category-color', category === 'All' ? colorForSkillCategory('All') : colorForSkillTag(category));
}
