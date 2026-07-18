/** WHAT: Proves the shared Codex catalog selection contract. WHY: Every surface must filter and order identical records identically. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleCodexLibraryRecords } from '../../../../src/runtime/codex/component/render-codex-library.js';

const alpha = { id: 'alpha', name: 'Alpha', description: 'Analyze interfaces', favorite: false, tags: ['Interface'], projects: [{ id: 'one', name: 'One' }] };
const beta = { id: 'beta', name: 'Beta', description: 'Build reports', favorite: true, tags: ['Reporting'], projects: [{ id: 'two', name: 'Two' }] };
const gamma = { id: 'gamma', name: 'Gamma', description: 'Build interfaces', favorite: true, tags: ['Interface'], projects: [{ id: 'one', name: 'One' }] };

test('shared catalog combines query, project, and tag filters', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([alpha, beta, gamma], { query: 'build', projectId: 'one', tag: 'Interface' }, true).map((record) => record.id),
    ['gamma'],
  );
});

test('shared skill ordering keeps favorites first and names deterministic', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([gamma, alpha, beta], { query: '', projectId: 'All', tag: 'All' }, true).map((record) => record.id),
    ['beta', 'gamma', 'alpha'],
  );
});

test('shared pipeline ordering ignores favorite state when disabled', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([gamma, alpha, beta], { query: '', projectId: 'All', tag: 'All' }).map((record) => record.id),
    ['alpha', 'beta', 'gamma'],
  );
});
