import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');

test('mobile projects identify remote ownership and disable offline owners', () => {
  assert.match(source, /badge\.textContent = project\.online \? \(project\.ownerNodeLabel \|\| project\.ownerNodeId\) : 'Owner offline'/);
  assert.match(source, /button\.disabled = project\.remote && !project\.online/);
  assert.match(source, /project\.remote \? `Owned by \$\{project\.ownerNodeLabel \|\| project\.ownerNodeId\}` : project\.relativePath/);
  assert.match(source, /project-settings-button'\)\.hidden = Boolean\(project\.remote\)/);
});
