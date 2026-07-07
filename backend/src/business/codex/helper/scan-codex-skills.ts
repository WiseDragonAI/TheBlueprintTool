/**
 * WHAT: Discovers Codex skills available to the workspace.
 * WHY: The browser should list skill names and descriptions without accepting filesystem paths from the client.
 */
import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export type CodexSkillSource = 'workspace' | 'user' | 'plugin';

export type CodexSkillSummary = {
  name: string;
  description: string;
  source: CodexSkillSource;
  skillFile: string;
};

type SkillRoot = {
  directory: string;
  source: CodexSkillSource;
  maxDepth: number;
};

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function codexHome(): string {
  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
}

function candidateSkillRoots(workspaceRoot: string): SkillRoot[] {
  const home = codexHome();
  const workspaceSkills = resolve(workspaceRoot, '.skills');
  const cwdSkills = resolve(process.cwd(), '.skills');
  return [
    ...uniqueValues([workspaceSkills, cwdSkills]).map((directory) => ({ directory, source: 'workspace' as const, maxDepth: 5 })),
    { directory: resolve(home, 'skills'), source: 'user' as const, maxDepth: 6 },
    { directory: resolve(home, 'plugins', 'cache'), source: 'plugin' as const, maxDepth: 10 },
  ];
}

function collectSkillFiles(directory: string, maxDepth: number, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(directory)) return [];
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(directory, entry.name);
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(child);
    if (entry.isDirectory()) files.push(...collectSkillFiles(child, maxDepth, depth + 1));
  }
  return files;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  return (quote === '"' || quote === "'") && trimmed.endsWith(quote)
    ? trimmed.slice(1, -1)
    : trimmed;
}

function parseSkillFrontmatter(markdown: string): { name: string; description: string } | null {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const metadata: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '---') break;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    metadata[match[1]] = unquote(match[2] ?? '');
  }
  const name = String(metadata.name ?? '').trim();
  if (!name) return null;
  return { name, description: String(metadata.description ?? '').trim() };
}

function readSkillSummary(skillFile: string, source: CodexSkillSource): CodexSkillSummary | null {
  try {
    if (!statSync(skillFile).isFile()) return null;
    const metadata = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'));
    if (!metadata) return null;
    return { ...metadata, source, skillFile };
  } catch {
    return null;
  }
}

export function scanCodexSkills(input: { workspaceRoot: string }): CodexSkillSummary[] {
  const byName = new Map<string, CodexSkillSummary>();
  for (const root of candidateSkillRoots(input.workspaceRoot)) {
    for (const skillFile of collectSkillFiles(root.directory, root.maxDepth)) {
      const summary = readSkillSummary(skillFile, root.source);
      if (!summary || byName.has(summary.name)) continue;
      byName.set(summary.name, summary);
    }
  }
  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}
