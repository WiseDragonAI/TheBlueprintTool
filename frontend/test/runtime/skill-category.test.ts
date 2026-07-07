import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryForSkill, skillCategories } from '../../src/runtime/codex/helper/skill-category.js';

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
