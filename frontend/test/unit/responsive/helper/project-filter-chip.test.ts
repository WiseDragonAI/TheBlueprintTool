/**
 * WHAT: Verifies project-filter chip content, remote identity, and YIQ foreground selection.
 * WHY: Project colors vary while the compact chip contract must stay legible and name-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectFilterChipPresentation, projectFilterForeground } from '../../../../src/app/responsive/project-filter-chip.js';

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
