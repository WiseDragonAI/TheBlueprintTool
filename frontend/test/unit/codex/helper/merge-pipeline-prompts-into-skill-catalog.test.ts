import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePipelinePromptsIntoSkillCatalog } from '../../../../src/runtime/codex/helper/merge-pipeline-prompts-into-skill-catalog.js';

test('adds pipeline prompts without replacing an existing skill identity', () => {
  const existing = { name: 'analysis', contentKind: 'federated-skill', description: 'Existing skill.' };
  const duplicate = { name: 'analysis', contentKind: 'pipeline-prompt', description: 'Prompt collision.' };
  const prompt = { name: 'gate', contentKind: 'pipeline-prompt', description: 'Pipeline gate.' };
  const ignored = { name: 'workspace-only', contentKind: 'workspace-skill', description: 'Not a prompt.' };

  assert.deepEqual(
    mergePipelinePromptsIntoSkillCatalog([existing], [duplicate, prompt, ignored]),
    [existing, prompt],
  );
});
