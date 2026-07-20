/**
 * WHAT: Guards repository-grouped Control Room project filters and their styling contract.
 * WHY: Terminal copies share one chip while selection, offline semantics, and task ownership remain intact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const source = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('Control Room keeps project chips compact and reserves shortcut controls for task creation', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const css = source('frontend/assets/application.css');

  assert.match(application, /projectFilterGroups\(state\.projects\)/);
  assert.match(application, /projectFilterIncludes\(selectedProject, task\.projectId\)/);
  assert.match(application, /const projectFilters = \[\{ id: 'All',[\s\S]*\.\.\.projectFilterGroups\(state\.projects\)\]/);
  assert.match(application, /const presentation = projectFilterChipPresentation\(project\)/);
  assert.match(application, /button\.textContent = presentation\.label/);
  assert.doesNotMatch(application, /project-filter-label/);
  assert.doesNotMatch(application, /node-filter-cycle/);
  assert.doesNotMatch(application, /button\.textContent[^\n]*(ownerNodeLabel|projectPresenceLabel|Online|Offline)/);
  assert.match(application, /project\.projects\.map\(projectOwnerLabel\)\.join\(', '\)/);
  assert.match(application, /button\.disabled = project\.online === false/);
  assert.match(application, /button\.setAttribute\('aria-pressed', String\(project\.id === selected\)\)/);
  assert.match(application, /projectFilterButton\(project, state\.projectFilter, selectControlProject\)/);
  assert.match(application, /button\.style\.setProperty\('--project-foreground', presentation\.foreground\)/);
  assert.match(application, /if \(presentation\.showRemoteMarker\) {[\s\S]*createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*setAttribute\('aria-hidden', 'true'\)[\s\S]*button\.append\(remoteIcon\)/);

  assert.match(application, /projectFilters\.find\(\(project\) => project\.id === state\.projectFilter\)\?\.ledgers/);

  assert.match(css, /\.project-filter-chip\s*{[^}]*position:\s*relative;[^}]*color:\s*var\(--project-foreground\);/s);
  assert.doesNotMatch(css, /\.project-filter-chip \.terminal-button__key/);
  assert.doesNotMatch(css, /\.node-filter-cycle/);
  assert.match(css, /\.project-filter-remote-icon\s*{[^}]*position:\s*absolute;[^}]*top:\s*3px;[^}]*right:\s*3px;[^}]*stroke:\s*currentColor;/s);
});
