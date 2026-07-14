import test from 'node:test';
import assert from 'node:assert/strict';
import { sortSkillsByFavorite } from '../../../../src/runtime/codex/helper/skill-library-presentation.js';

test('favorite skills sort first with deterministic names inside each group', () => {
  const sorted = sortSkillsByFavorite([
    { name: 'zeta', favorite: false },
    { name: 'beta', favorite: true },
    { name: 'alpha', favorite: true },
    { name: 'gamma' },
  ]);
  assert.deepEqual(sorted.map((skill) => skill.name), ['alpha', 'beta', 'gamma', 'zeta']);
});
