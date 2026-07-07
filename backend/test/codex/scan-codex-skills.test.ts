import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';

test('scanCodexSkills reads workspace user and plugin skill frontmatter', () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skills-workspace-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skills-home-'));

  try {
    process.env.CODEX_HOME = codexHome;
    mkdirSync(join(workspace, '.skills', 'duplicate-skill'), { recursive: true });
    mkdirSync(join(codexHome, 'skills', 'duplicate-skill'), { recursive: true });
    mkdirSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill'), { recursive: true });

    writeFileSync(join(workspace, '.skills', 'duplicate-skill', 'SKILL.md'), [
      '---',
      'name: duplicate-skill',
      'description: Workspace skill wins',
      '---',
      '',
    ].join('\n'));
    writeFileSync(join(codexHome, 'skills', 'duplicate-skill', 'SKILL.md'), [
      '---',
      'name: duplicate-skill',
      'description: User skill loses',
      '---',
      '',
    ].join('\n'));
    writeFileSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md'), [
      '---',
      'name: plugin-skill',
      'description: Plugin skill description',
      '---',
      '',
    ].join('\n'));

    const skills = scanCodexSkills({ workspaceRoot: workspace });
    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
    const plugin = skills.find((skill) => skill.name === 'plugin-skill');

    assert.equal(duplicate?.description, 'Workspace skill wins');
    assert.equal(duplicate?.source, 'workspace');
    assert.equal(plugin?.description, 'Plugin skill description');
    assert.equal(plugin?.source, 'plugin');
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});
