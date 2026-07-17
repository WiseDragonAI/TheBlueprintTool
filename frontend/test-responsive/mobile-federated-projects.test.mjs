import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');

test('all project choices identify ownership and presence and disable offline owners', () => {
  assert.match(source, /badge\.textContent = projectPresenceLabel\(project\)/);
  assert.match(source, /badge\.hidden = false/);
  assert.match(source, /button\.disabled = project\.remote && !project\.online/);
  assert.match(source, /`Owned by \$\{projectOwnerLabel\(project\)\} · \$\{project\.id\}`/);
  assert.match(source, /owner\.textContent = `\$\{projectPresenceLabel\(project\)\} · \$\{project\.id\}`/);
  assert.match(source, /`\$\{task\.projectName\} · \$\{taskOwner\} · \$\{task\.ledger\}/);
  assert.match(source, /project-settings-button'\)\.hidden = Boolean\(project\.remote\)/);
});
