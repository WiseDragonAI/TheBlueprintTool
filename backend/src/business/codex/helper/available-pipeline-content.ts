/**
 * WHAT: Resolves the canonical saved-pipeline content identities available to one workspace.
 * WHY: Startup migration, reads, writes, and execution admission must make the same discriminator decision.
 */
import { dirname } from 'node:path';
import type { CodexContentKind } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { scanPipelinePrompts } from './pipeline-prompt-library.js';
import { scanCodexSkills } from './scan-codex-skills.js';
import { serverPipelineDecisionOsRoot } from './server-pipeline-catalog.js';
import { runtimeServerRoot } from './server-skill-context.js';

type AnyRecord = Record<string, unknown>;

export function availablePipelineContent(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
}): { names: string[]; kinds: Map<string, CodexContentKind> } {
  const skills = scanCodexSkills({
    workspaceRoot: dirname(input.decisionOsRoot),
    serverRoot: runtimeServerRoot(input.runtime),
  });
  const prompts = scanPipelinePrompts(serverPipelineDecisionOsRoot(input.runtime, input.decisionOsRoot));
  const kinds = new Map<string, CodexContentKind>([
    ...skills.map((skill): [string, CodexContentKind] => [
      skill.name,
      skill.source === 'server' ? 'federated-skill' : 'workspace-skill',
    ]),
    // WHAT: A registered pipeline prompt wins a same-name skill collision.
    // WHY: Prompt admission requires an immutable prompt snapshot, so treating it as an agent skill would change execution semantics.
    ...prompts.map((prompt): [string, CodexContentKind] => [prompt.name, 'pipeline-prompt']),
  ]);
  return { names: [...kinds.keys()], kinds };
}
