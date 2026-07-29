import test from 'node:test';
import assert from 'node:assert/strict';
import { codexSkillAuthoringProjectId } from '../../../../src/runtime/codex/helper/codex-skill-authoring-path.js';

test('routes only workspace skills through the active project authoring boundary', () => {
  assert.equal(codexSkillAuthoringProjectId({ contentKind: 'workspace-skill' }, 'project-a'), 'project-a');
  assert.equal(codexSkillAuthoringProjectId({ source: 'workspace' }, 'project-a'), 'project-a');
  assert.equal(codexSkillAuthoringProjectId({ contentKind: 'pipeline-prompt' }, 'project-a'), '');
  assert.equal(codexSkillAuthoringProjectId({ contentKind: 'federated-skill' }, 'project-a'), '');
});
