import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryForSkill, colorForSkillCategory, skillCategories } from '../../src/runtime/codex/helper/skill-category.js';

test('skillCategories exposes the compact modal taxonomy', () => {
  assert.deepEqual(skillCategories, [
    'Architecture',
    'Implementation',
    'Interface',
    'Writing',
    'Marketing',
    'Product',
    'Research',
    'Automation',
    'Artifacts',
    'Platform',
  ]);
});

test('categoryForSkill maps known skills and leaves custom skills explicit', () => {
  assert.equal(categoryForSkill('over-engineering-analysis'), 'Architecture');
  assert.equal(categoryForSkill('frontend-design'), 'Implementation');
  assert.equal(categoryForSkill('implementation-orchestrator'), 'Implementation');
  assert.equal(categoryForSkill('task-dependency'), 'Implementation');
  assert.equal(categoryForSkill('task-group-completeness'), 'Implementation');
  assert.equal(categoryForSkill('test-failure-attribution'), 'Implementation');
  assert.equal(categoryForSkill('ui-audit'), 'Interface');
  assert.equal(categoryForSkill('copywriting'), 'Writing');
  assert.equal(categoryForSkill('page-cro'), 'Marketing');
  assert.equal(categoryForSkill('jobs-to-be-done'), 'Product');
  assert.equal(categoryForSkill('corpus-data-extraction'), 'Research');
  assert.equal(categoryForSkill('browser'), 'Automation');
  assert.equal(categoryForSkill('documents'), 'Artifacts');
  assert.equal(categoryForSkill('openai-docs'), 'Platform');
  assert.equal(categoryForSkill('custom-local-skill'), 'Uncategorized');
});

test('colorForSkillCategory returns stable color tokens for modal tags', () => {
  assert.equal(colorForSkillCategory('All'), '#cbd5e1');
  assert.equal(colorForSkillCategory('Architecture'), '#60a5fa');
  assert.equal(colorForSkillCategory('Implementation'), '#34d399');
  assert.equal(colorForSkillCategory('Interface'), '#f472b6');
  assert.equal(colorForSkillCategory('Writing'), '#fbbf24');
  assert.equal(colorForSkillCategory('Marketing'), '#fb7185');
  assert.equal(colorForSkillCategory('Product'), '#a78bfa');
  assert.equal(colorForSkillCategory('Research'), '#22d3ee');
  assert.equal(colorForSkillCategory('Automation'), '#f97316');
  assert.equal(colorForSkillCategory('Artifacts'), '#84cc16');
  assert.equal(colorForSkillCategory('Platform'), '#a3a3a3');
  assert.equal(colorForSkillCategory('Uncategorized'), '#94a3b8');
});
