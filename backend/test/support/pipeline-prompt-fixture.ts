import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const timestamp = '2026-07-28T00:00:00.000Z';

export const testSystemPrompt = [
  'platform: <PLATFORM>',
  'Git commits you create, including merges, require a concise subject and body:',
  '- WHAT: changed boundary.',
  '- WHY: reason and decision evidence.',
].join('\n');

export const testPipelineSkillPrompt = [
  '$<SKILL_NAME>',
  'Ledger file: <LEDGER_FILE>',
  'Current skill: <SKILL_NAME>',
  '<SERVER_SKILL_CONTEXT>',
  'Write the final result to this Markdown file: <OUTPUT_MARKDOWN_FILE>',
].join('\n');

export const testCodexRunPrompt = [
  'Decision OS card run:',
  '- Project: `<PROJECT_ID>`.',
  '- `ledger-cli` writes only; use `master-task-apply`.',
  '- One `master-task-progress --plan-stdin --json`; replicated lifecycle and positioned `subtask` relationships are authoritative.',
  '- Keep the master-task body a living strategic summary for a CTO, never as a run log, implementation inventory, or verification report; replace the complete body with the current strategic state.',
  '- Use letter-prefixed H2 sections, --- between sections, numbered list items.',
  '- Present one credible path and why it advances the objective.',
  '- Include global context and objective; verified current state; strategic constraints and choices; current decision or blocker. Keep relationship membership and lifecycle state out of Markdown.',
  '- Omit test counts, routine verification results, file inventories, commits, pushes, process narration, and implementation chronology; never expose raw UUIDs, run IDs, card IDs, thread IDs, relationship IDs, hashes, encoded project IDs, or timestamps.',
  '- Master-task rendered-output gate: inspect the complete rendered summary. Do not submit a partially compliant summary.',
  '- The thread reply is a separate CTO-facing iteration record: very short numbered bullets with no heading or section for material outcomes from this iteration.',
  '- Never include raw UUIDs or other opaque internal identifiers in the reply; name the human-readable subject and outcome instead. Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions. Put all reasoning and complete task state in the master-task body.',
  '- Never close or mark the master task done from a normal card run except by direct operator action or an explicitly invoked closeout skill.',
  '<RUN_SKILL_POLICY>- `ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <CARD_ID> --json`.',
  '- `ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id <THREAD_ID> --message-stdin`.',
  '- Follow the workspace `AGENTS.md` Markdown contract.<PROTECTED_GIT_PATCH>',
].join('\n');

export function installPipelinePromptFixture(input: {
  workspace: string;
  decisionOsRoot: string;
  commit?: boolean;
}): void {
  const promptRoot = join(input.decisionOsRoot, 'pipeline-prompts');
  const storeFile = join(input.decisionOsRoot, 'codex-pipelines.json');
  mkdirSync(promptRoot, { recursive: true });
  writeFileSync(join(promptRoot, 'SYSTEM_PROMPT.md'), testSystemPrompt);
  writeFileSync(join(promptRoot, 'SKILL.md'), testPipelineSkillPrompt);
  writeFileSync(join(promptRoot, 'CODEX_RUN.md'), testCodexRunPrompt);

  const store = existsSync(storeFile)
    ? JSON.parse(readFileSync(storeFile, 'utf8')) as Record<string, any>
    : {
        version: 2,
        pipelines: [],
        steps: [],
        runs: [],
        skillLibrary: [],
        authoredContent: [],
        activeWorkspaceRun: null,
      };
  const authoredContent = Array.isArray(store.authoredContent)
    ? store.authoredContent.filter((entry: Record<string, unknown>) => (
        entry.id !== 'SYSTEM_PROMPT' && entry.id !== 'SKILL' && entry.id !== 'CODEX_RUN'
      ))
    : [];
  store.version = 2;
  store.authoredContent = [
    ...authoredContent,
    {
      id: 'SYSTEM_PROMPT',
      kind: 'pipeline-prompt',
      description: 'System prompt fixture',
      contentFile: 'pipeline-prompts/SYSTEM_PROMPT.md',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'SKILL',
      kind: 'pipeline-prompt',
      description: 'Skill prompt fixture',
      contentFile: 'pipeline-prompts/SKILL.md',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'CODEX_RUN',
      kind: 'pipeline-prompt',
      description: 'Direct Codex run prompt fixture',
      contentFile: 'pipeline-prompts/CODEX_RUN.md',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  writeFileSync(storeFile, `${JSON.stringify(store, null, 2)}\n`);

  if (input.commit === false) return;
  try {
    execFileSync('git', ['-C', input.workspace, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
  } catch {
    execFileSync('git', ['-C', input.workspace, 'init', '-q']);
    execFileSync('git', ['-C', input.workspace, 'config', 'user.name', 'Decision OS Test']);
    execFileSync('git', ['-C', input.workspace, 'config', 'user.email', 'test@decision-os.invalid']);
  }
  execFileSync('git', [
    '-C',
    input.workspace,
    'add',
    '--force',
    '--',
    relative(input.workspace, join(input.decisionOsRoot, 'pipeline-prompts', 'SYSTEM_PROMPT.md')),
    relative(input.workspace, join(input.decisionOsRoot, 'pipeline-prompts', 'SKILL.md')),
    relative(input.workspace, join(input.decisionOsRoot, 'pipeline-prompts', 'CODEX_RUN.md')),
    relative(input.workspace, storeFile),
  ]);
  execFileSync('git', [
    '-C',
    input.workspace,
    '-c',
    'user.name=Decision OS Test',
    '-c',
    'user.email=test@decision-os.invalid',
    'commit',
    '-q',
    '-m',
    'Seed pipeline prompt fixture',
  ]);
}
