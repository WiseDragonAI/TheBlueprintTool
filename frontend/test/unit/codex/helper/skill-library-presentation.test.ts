import test from 'node:test';
import assert from 'node:assert/strict';
import { colorForSkillTag, skillInstructionMarkdown, sortSkillsByFavorite, tagsForSkill } from '../../../../src/runtime/codex/helper/skill-library-presentation.js';

test('favorite skills sort first with deterministic names inside each group', () => {
  const sorted = sortSkillsByFavorite([
    { name: 'zeta', favorite: false },
    { name: 'beta', favorite: true },
    { name: 'alpha', favorite: true },
    { name: 'gamma' },
  ]);
  assert.deepEqual(sorted.map((skill) => skill.name), ['alpha', 'beta', 'gamma', 'zeta']);
});

test('stored tags replace the inferred fallback and custom tags receive stable colors', () => {
  assert.deepEqual(tagsForSkill({ name: 'unknown-skill' }), ['Uncategorized']);
  assert.deepEqual(tagsForSkill({ name: 'analysis', tags: ['Priority', 'Research', 'Priority'] }), ['Priority', 'Research']);
  assert.equal(colorForSkillTag('Priority'), colorForSkillTag('Priority'));
  assert.match(colorForSkillTag('Priority'), /^#[0-9a-f]{6}$/i);
});

test('skill instruction Markdown omits frontmatter while preserving the readable body', () => {
  assert.equal(skillInstructionMarkdown('---\r\nname: example\r\ndescription: Example\r\n---\r\n\r\n# Instructions\r\n\r\nRead me.\r\n'), '# Instructions\n\nRead me.');
  assert.equal(skillInstructionMarkdown('# Instructions\n\nRead me.'), '# Instructions\n\nRead me.');
});
