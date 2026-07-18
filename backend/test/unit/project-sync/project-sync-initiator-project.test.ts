import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findOrMaterializeInitiatorProject } from '../../../src/business/project-sync/controller/start-project-sync.js';
import { readRepositorySyncStatus } from '../../../src/business/project-sync/helper/repository-sync-status.js';
import type { DecisionOsProject } from '../../../src/business/server/helper/project-catalog.js';

function git(root: string, ...args: string[]): void {
  execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
}

function project(id: string, name: string, root: string): DecisionOsProject {
  return {
    id,
    name,
    relativePath: name,
    root,
    decisionOsRoot: join(root, '.decision-os'),
    description: '',
    color: '#000000',
    available: true,
    diagnostic: '',
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  };
}

test('materializes a remote source project before selecting its workstation task owner', () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-owner-'));
  const origin = join(home, 'lis-origin.git');
  const sourceRoot = join(home, 'source-node-lis');
  const workstationRoot = join(home, 'workstation');
  const adminRoot = join(workstationRoot, 'admin');
  try {
    mkdirSync(workstationRoot);
    mkdirSync(join(adminRoot, '.decision-os'), { recursive: true });
    execFileSync('git', ['init', '--bare', origin], { stdio: 'pipe' });
    execFileSync('git', ['clone', origin, sourceRoot], { stdio: 'pipe' });
    git(sourceRoot, 'config', 'user.name', 'Decision OS Test');
    git(sourceRoot, 'config', 'user.email', 'test@decision-os.invalid');
    mkdirSync(join(sourceRoot, '.decision-os'));
    writeFileSync(join(sourceRoot, '.decision-os', 'state.json'), '{"ledgers":[{"id":"specs","title":"Specs","ledgerFile":".decision-os/specs.json"}]}\n');
    writeFileSync(join(sourceRoot, '.decision-os', 'specs.json'), '{"cards":[],"annotations":[],"relationships":[]}\n');
    git(sourceRoot, 'add', '.decision-os');
    git(sourceRoot, 'commit', '-m', 'initialize LIS');
    git(sourceRoot, 'push', '-u', 'origin', 'HEAD');

    const sourceSnapshot = readRepositorySyncStatus(sourceRoot);
    const admin = project('admin-project', 'Admin', adminRoot);
    let registeredPath = '';
    const result = findOrMaterializeInitiatorProject({
      masterRoot: workstationRoot,
      projects: () => [admin],
      catalog: {
        register(path: string) {
          registeredPath = path;
          return project('lis-project', 'LIS', join(workstationRoot, path));
        },
      },
      source: { ...project('node-b:lis-project', 'LIS', sourceRoot), ownerNodeId: 'node-b', localProjectId: 'lis-project', online: true },
      sourceSnapshot,
    });

    assert.equal(registeredPath, 'LIS');
    assert.equal(result.id, 'lis-project');
    assert.equal(result.name, 'LIS');
    assert.equal(readRepositorySyncStatus(result.root).originFingerprint, sourceSnapshot.originFingerprint);
    assert.notEqual(result.id, admin.id);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
