/**
 * WHAT: Verifies repository-aware project groups, chip content, and YIQ foreground selection.
 * WHY: Terminal copies must share one filter without collapsing distinct projects from the same repository.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectFilterChipPresentation,
  projectFilterForeground,
  projectFilterGroups,
  projectFilterIncludes,
} from '../../../../src/app/responsive/project-filter-chip.js';

test('project filter foreground follows the specified YIQ threshold', () => {
  const cases = [
    { color: '#ffd732', foreground: '#000000' },
    { color: '#59a8f8', foreground: '#ffffff' },
    { color: '#ffffff', foreground: '#000000' },
    { color: '#000000', foreground: '#ffffff' },
  ];

  for (const example of cases) {
    assert.equal(projectFilterForeground(example.color), example.foreground, example.color);
  }
});

test('project filter presentation does not expose replica routing as a remote project marker', () => {
  assert.deepEqual(
    projectFilterChipPresentation({ name: 'EditorBP', color: '#ffd732', replicas: [{ nodeId: 'mobile' }] }),
    { label: 'EditorBP', showRemoteMarker: false, foreground: '#000000' },
  );
});

test('project filters preserve canonical project identity', () => {
  const projects = [
    {
      id: 'decision-os', name: 'decision-os', color: '#895cfa', online: true,
      ledgers: [{ id: 'specs', title: 'Specs' }, { id: 'tasks', title: 'Tasks' }],
      replicas: [{ projectId: 'decision-os', nodeId: 'workstation' }, { projectId: 'decision-os', nodeId: 'mobile' }],
    },
    {
      id: 'search', name: 'Search', color: '#fbbf24', online: true, ledgers: [{ id: 'tasks', title: 'tasks' }],
    },
  ];

  const groups = projectFilterGroups(projects);
  assert.equal(groups.length, 2, 'a distinct project in the same repository stays separate');
  const decisionOs = groups.find((group) => group.name === 'decision-os');
  assert.ok(decisionOs);
  assert.equal(decisionOs.id, 'decision-os');
  assert.deepEqual(decisionOs.projectIds, ['decision-os']);
  assert.deepEqual(decisionOs.ledgers, [
    { id: 'specs', title: 'Specs' },
    { id: 'tasks', title: 'Tasks' },
  ]);
  assert.equal(projectFilterIncludes(decisionOs, 'decision-os'), true);
  assert.equal(projectFilterIncludes(decisionOs, 'search'), false);
});
