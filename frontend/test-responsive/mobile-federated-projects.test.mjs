import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');

test('all project choices identify ownership and presence and disable offline owners', () => {
  assert.match(source, /badge\.textContent = projectPresenceLabel\(project\)/);
  assert.match(source, /badge\.hidden = false/);
  assert.match(source, /button\.disabled = project\.remote && !project\.online/);
  assert.match(source, /`Owned by \$\{projectOwnerLabel\(project\)\} · \$\{project\.id\}`/);
  const projectPicker = source.slice(source.indexOf('function openNewTaskProjectModal()'), source.indexOf('function cardOverlapArea'));
  assert.match(projectPicker, /const nodeId = project\.ownerNodeId \|\| 'local'/);
  assert.match(projectPicker, /local: project\.remote !== true/);
  assert.match(projectPicker, /const defaultNode = nodes\.find\(\(node\) => node\.local\) \?\? nodes\[0\]/);
  assert.match(projectPicker, /presence\.textContent = node\.online \? 'Online' : 'Offline'/);
  assert.match(projectPicker, /button\.disabled = activeNode\.online === false/);
  assert.doesNotMatch(projectPicker, /owner\.textContent|projectPresenceLabel\(project\)|aria-label.*project\.id/);
  assert.match(source, /`\$\{task\.projectName\} · \$\{taskOwner\} · \$\{task\.ledger\}/);
  assert.match(source, /project-settings-button'\)\.hidden = Boolean\(project\.remote\)/);
});
