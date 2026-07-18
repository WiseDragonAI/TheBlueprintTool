import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSyncGitSshCommand } from '../../../src/business/project-sync/helper/project-sync-git-ssh-command.js';

test('builds a non-interactive project synchronization SSH command from an explicit identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-ssh-'));
  const identity = join(root, "wise identity");
  try {
    writeFileSync(identity, 'fixture');
    assert.equal(
      projectSyncGitSshCommand({ projectSyncGitSshIdentityFile: identity }),
      `ssh -i '${identity}' -o IdentitiesOnly=yes -o BatchMode=yes`,
    );
    assert.equal(projectSyncGitSshCommand({}), '');
    assert.throws(() => projectSyncGitSshCommand({ projectSyncGitSshIdentityFile: 'relative-key' }), /must be absolute/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
