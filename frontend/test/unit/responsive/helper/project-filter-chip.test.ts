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

test('project filter presentation exposes only the name and an exact remote marker flag', () => {
  const cases = [
    { remote: true, showRemoteMarker: true },
    { remote: false, showRemoteMarker: false },
    { remote: undefined, showRemoteMarker: false },
  ];

  for (const example of cases) {
    assert.deepEqual(
      projectFilterChipPresentation({ name: 'EditorBP', color: '#ffd732', remote: example.remote }),
      { label: 'EditorBP', showRemoteMarker: example.showRemoteMarker, foreground: '#000000' },
    );
  }
});

test('project filters merge terminal copies by origin and logical project identity', () => {
  const projects = [
    {
      id: 'decision-os', localProjectId: 'decision-os', name: 'decision-os', color: '#895cfa',
      originFingerprint: 'same-origin', remote: false, online: false,
      ledgers: [{ id: 'specs', title: 'Specs from workstation' }],
    },
    {
      id: 'phone:decision-os', localProjectId: 'decision-os', name: 'decision-os', color: '#a78bfa',
      originFingerprint: '', remote: true, online: true,
      ledgers: [{ id: 'specs', title: 'Specs from phone' }, { id: 'tasks', title: 'Tasks' }],
    },
    {
      id: 'search', localProjectId: 'search', name: 'Search', color: '#fbbf24',
      originFingerprint: 'same-origin', remote: false, online: true, ledgers: [{ id: 'tasks', title: 'tasks' }],
    },
  ];

  const groups = projectFilterGroups(projects);
  assert.equal(groups.length, 2, 'a distinct project in the same repository stays separate');
  const decisionOs = groups.find((group) => group.name === 'decision-os');
  assert.ok(decisionOs);
  assert.deepEqual(decisionOs.projectIds, ['decision-os', 'phone:decision-os']);
  assert.equal(decisionOs.color, '#895cfa', 'the local project owns canonical presentation');
  assert.equal(decisionOs.online, true, 'one online terminal keeps the repository filter enabled');
  assert.deepEqual(decisionOs.ledgers, [
    { id: 'specs', title: 'Specs from workstation' },
    { id: 'tasks', title: 'Tasks' },
  ]);
  assert.equal(projectFilterIncludes(decisionOs, 'decision-os'), true);
  assert.equal(projectFilterIncludes(decisionOs, 'phone:decision-os'), true);
  assert.equal(projectFilterIncludes(decisionOs, 'search'), false);
});

test('a conflicting remote origin cannot join the local logical project', () => {
  const groups = projectFilterGroups([
    {
      id: 'decision-os', localProjectId: 'decision-os', name: 'decision-os', color: '#895cfa',
      originFingerprint: 'workstation-origin', remote: false,
    },
    {
      id: 'phone:decision-os', localProjectId: 'decision-os', name: 'decision-os', color: '#a78bfa',
      originFingerprint: 'different-origin', remote: true,
    },
  ]);

  assert.equal(groups.length, 2);
});

test('projects without an origin fingerprint remain distinct', () => {
  const groups = projectFilterGroups([
    { id: 'local-home', localProjectId: 'home', name: 'home', color: '#38d9e8' },
    { id: 'phone:home', localProjectId: 'home', name: 'home', color: '#38d9e8', remote: true },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.projectIds), [['local-home'], ['phone:home']]);
});
