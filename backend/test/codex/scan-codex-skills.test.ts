import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';

function skillMarkdown(name: string, description: string, body = '# Instructions\n\nDo the work.'): string {
  return ['---', `name: ${name}`, `description: ${description}`, '---', '', body, ''].join('\n');
}

test('scanCodexSkills classifies sources, preserves precedence, and returns stable editability metadata', () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skills-workspace-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skills-home-'));
  const external = mkdtempSync(join(tmpdir(), 'decision-os-skills-external-'));

  try {
    process.env.CODEX_HOME = codexHome;
    const workspaceSkill = join(workspace, '.skills', 'duplicate-skill', 'SKILL.md');
    const userSkill = join(codexHome, 'skills', 'duplicate-skill', 'SKILL.md');
    const ordinaryUserSkill = join(codexHome, 'skills', 'user-skill', 'SKILL.md');
    const systemSkill = join(codexHome, 'skills', '.system', 'system-skill', 'SKILL.md');
    const pluginSkill = join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md');
    const externalSkill = join(external, 'SKILL.md');
    for (const file of [workspaceSkill, userSkill, ordinaryUserSkill, systemSkill, pluginSkill, externalSkill]) {
      mkdirSync(join(file, '..'), { recursive: true });
    }
    writeFileSync(workspaceSkill, [
      '---',
      'name: duplicate-skill',
      'description: >-',
      '  Workspace skill wins with',
      '  a folded description',
      '---',
      '',
      '# Workspace instructions',
      '',
    ].join('\n'));
    writeFileSync(userSkill, skillMarkdown('duplicate-skill', 'User skill loses'));
    writeFileSync(ordinaryUserSkill, skillMarkdown('user-skill', 'Ordinary user skill'));
    writeFileSync(systemSkill, skillMarkdown('system-skill', 'System skill'));
    writeFileSync(pluginSkill, skillMarkdown('plugin-skill', 'Plugin skill'));
    writeFileSync(externalSkill, skillMarkdown('escaped-skill', 'Escaped skill'));
    symlinkSync(external, join(workspace, '.skills', 'symlinked-skill'), 'dir');

    const skills = scanCodexSkills({ workspaceRoot: workspace });
    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
    const user = skills.find((skill) => skill.name === 'user-skill');
    const system = skills.find((skill) => skill.name === 'system-skill');
    const plugin = skills.find((skill) => skill.name === 'plugin-skill');

    assert.equal(duplicate?.description, 'Workspace skill wins with a folded description');
    assert.equal(duplicate?.source, 'workspace');
    assert.equal(duplicate?.editable, true);
    assert.equal(duplicate?.readOnlyReason, null);
    assert.match(duplicate?.revision ?? '', /^[a-f0-9]{64}$/);
    assert.equal(user?.source, 'user');
    assert.equal(user?.editable, true);
    assert.equal(user?.readOnlyReason, null);
    assert.equal(system?.source, 'system');
    assert.equal(system?.editable, false);
    assert.equal(system?.readOnlyReason, 'System skills are read-only.');
    assert.equal(plugin?.source, 'plugin');
    assert.equal(plugin?.editable, false);
    assert.equal(plugin?.readOnlyReason, 'Plugin skills are read-only.');
    assert.equal(skills.some((skill) => skill.name === 'escaped-skill'), false);

    const firstRevision = duplicate?.revision;
    writeFileSync(workspaceSkill, skillMarkdown('duplicate-skill', 'Workspace skill changed', '# Changed'));
    const changed = scanCodexSkills({ workspaceRoot: workspace }).find((skill) => skill.name === 'duplicate-skill');
    assert.notEqual(changed?.revision, firstRevision);
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});
