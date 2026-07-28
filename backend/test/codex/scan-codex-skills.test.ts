import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';
import { resolveServerSkillContext } from '@backend/business/codex/helper/server-skill-context.js';
import { buildPipelineSkillPrompt } from '@backend/business/codex/helper/build-pipeline-skill-prompt.js';

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
    const sameRootSkills = scanCodexSkills({ workspaceRoot: workspace, serverRoot: workspace });
    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
    const user = skills.find((skill) => skill.name === 'user-skill');
    const system = skills.find((skill) => skill.name === 'system-skill');
    const plugin = skills.find((skill) => skill.name === 'plugin-skill');

    assert.equal(duplicate?.description, 'Workspace skill wins with a folded description');
    assert.equal(duplicate?.source, 'workspace');
    assert.equal(duplicate?.editable, true);
    assert.equal(duplicate?.readOnlyReason, null);
    assert.equal(sameRootSkills.find((skill) => skill.name === 'duplicate-skill')?.source, 'workspace');
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

test('one server skill wins in every managed project and supplies exact run instructions', () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-server-skill-root-'));
  const firstProject = join(serverRoot, 'projects', 'first');
  const secondProject = join(serverRoot, 'projects', 'second');
  const serverSkillFile = join(serverRoot, '.skills', 'shared-skill', 'SKILL.md');
  const projectDuplicate = join(firstProject, '.skills', 'shared-skill', 'SKILL.md');
  const markdown = skillMarkdown('shared-skill', 'Server-wide instructions', '# Server workflow');
  try {
    for (const directory of [firstProject, secondProject, join(serverSkillFile, '..'), join(projectDuplicate, '..')]) mkdirSync(directory, { recursive: true });
    writeFileSync(serverSkillFile, markdown);
    writeFileSync(projectDuplicate, skillMarkdown('shared-skill', 'Project duplicate'));
    const first = scanCodexSkills({ workspaceRoot: firstProject, serverRoot }).find((skill) => skill.name === 'shared-skill');
    const second = scanCodexSkills({ workspaceRoot: secondProject, serverRoot }).find((skill) => skill.name === 'shared-skill');
    assert.equal(first?.source, 'server');
    assert.equal(second?.source, 'server');
    assert.equal(first?.description, 'Server-wide instructions');
    assert.equal(first?.editable, false);
    const context = resolveServerSkillContext({
      decisionOsRoot: join(secondProject, '.decision-os'), runtime: { serverRoot }, skillName: 'shared-skill',
    });
    assert.deepEqual(context, { markdown, packageRoot: join(serverRoot, '.skills', 'shared-skill') });
    const prompt = buildPipelineSkillPrompt({
      skillName: 'shared-skill', ledgerFile: '/ledger.json', pipelineRunId: 'run', pipelineName: 'Pipeline',
      sourceCardId: 'source', sourceCardTitle: 'Source', stepId: 'step', stepTitle: 'Step',
      stepInputCardId: 'input', stepInputCardContent: 'Input', outputParentCardId: 'master',
      outputCardId: 'output', outputSubtaskPosition: 4, outputMarkdownFile: '/output.md', serverSkill: context,
    });
    assert.match(prompt, /Decision OS server skill package:/);
    assert.match(prompt, /# Server workflow/);
    assert.match(prompt, /Output subtask parent card id: master/);
    assert.match(prompt, /Output subtask card id: output/);
    assert.match(prompt, /Output subtask position: 4/);
    assert.match(prompt, /ledger-cli mutate --ledger "\$DECISION_OS_LEDGER_FILE" --card-id "output" --card-title "<result-specific-title>"/);
    assert.match(prompt, /Use letter-prefixed H2 sections, --- between sections, numbered list items\./);
    assert.doesNotMatch(prompt, /Do not edit the source card or any other pipeline step card\./);
    assert.doesNotMatch(prompt, /When finished, ensure the output Markdown file contains/);
  } finally {
    rmSync(serverRoot, { recursive: true, force: true });
  }
});
