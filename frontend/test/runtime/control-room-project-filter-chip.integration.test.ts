/**
 * WHAT: Guards the Control Room project-filter renderer and styling contract.
 * WHY: Visible federation metadata must stay compact without regressing selection or offline semantics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const source = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('Control Room keeps project chips compact and reserves shortcut controls for task creation', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const css = source('frontend/assets/application.css');

  assert.match(application, /const presentation = projectFilterChipPresentation\(project\)/);
  assert.match(application, /button\.textContent = presentation\.label/);
  assert.doesNotMatch(application, /project-filter-label/);
  assert.doesNotMatch(application, /node-filter-cycle/);
  assert.doesNotMatch(application, /button\.textContent[^\n]*(ownerNodeLabel|projectPresenceLabel|Online|Offline)/);
  assert.match(application, /button\.title = project\.id === 'All'[\s\S]*projectOwnerLabel\(project\)/);
  assert.match(application, /button\.disabled = project\.online === false/);
  assert.match(application, /button\.setAttribute\('aria-pressed', String\(project\.id === state\.projectFilter\)\)/);
  assert.match(application, /button\.style\.setProperty\('--project-foreground', presentation\.foreground\)/);
  assert.match(application, /if \(presentation\.showRemoteMarker\) {[\s\S]*createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*setAttribute\('aria-hidden', 'true'\)[\s\S]*button\.append\(remoteIcon\)/);

  assert.match(css, /\.project-filter-chip\s*{[^}]*position:\s*relative;[^}]*color:\s*var\(--project-foreground\);/s);
  assert.doesNotMatch(css, /\.project-filter-chip \.terminal-button__key/);
  assert.doesNotMatch(css, /\.node-filter-cycle/);
  assert.match(css, /\.project-filter-remote-icon\s*{[^}]*position:\s*absolute;[^}]*top:\s*3px;[^}]*right:\s*3px;[^}]*stroke:\s*currentColor;/s);
});
