/**
 * WHAT: Discovers Codex skills available to the workspace with server-owned source and editability metadata.
 * WHY: Clients select skills by identity while filesystem paths and write boundaries remain on the server.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, type Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

export type CodexSkillSource = 'server' | 'workspace' | 'user' | 'system' | 'plugin' | 'pipeline-prompt';

export type CodexSkillSummary = {
  name: string;
  description: string;
  source: CodexSkillSource;
  editable: boolean;
  readOnlyReason: string | null;
  revision: string;
  skillFile: string;
};

export type ParsedSkillFrontmatter = {
  name: string;
  description: string;
  body: string;
  closingLine: number;
};

export type SkillRoot = {
  directory: string;
  source: CodexSkillSource;
  maxDepth: number;
  excludedDirectories?: readonly string[];
};

export const importedFederatedSkillMarker = '.decision-os-imported-skill.json';

function codexHome(): string {
  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
}

export function candidateSkillRoots(workspaceRoot: string, serverRoot?: string): SkillRoot[] {
  const home = codexHome();
  const userSkills = resolve(home, 'skills');
  const systemSkills = resolve(userSkills, '.system');
  const workspace = resolve(workspaceRoot);
  const server = serverRoot ? resolve(serverRoot) : '';
  return [
    ...(server ? [{ directory: resolve(server, '.skills'), source: 'server' as const, maxDepth: 5 }] : []),
    ...(server !== workspace ? [{ directory: resolve(workspace, '.skills'), source: 'workspace' as const, maxDepth: 5 }] : []),
    { directory: userSkills, source: 'user', maxDepth: 6, excludedDirectories: [systemSkills] },
    { directory: systemSkills, source: 'system', maxDepth: 5 },
    { directory: resolve(home, 'plugins', 'cache'), source: 'plugin', maxDepth: 10 },
  ];
}

function collectSkillFiles(root: SkillRoot, directory = root.directory, depth = 0): string[] {
  if (depth > root.maxDepth || !existsSync(directory)) return [];
  const excluded = new Set((root.excludedDirectories ?? []).map((entry) => resolve(entry)));
  if (excluded.has(resolve(directory))) return [];
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(directory, entry.name);
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(child);
    if (entry.isDirectory()) files.push(...collectSkillFiles(root, child, depth + 1));
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

function metadataValue(lines: string[], startIndex: number, inlineValue: string): { value: string; nextIndex: number } {
  const continuation: string[] = [];
  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '---' || /^[A-Za-z0-9_-]+:\s*/.test(line)) break;
    if (/^\s+\S/.test(line)) continuation.push(line.trim());
    index += 1;
  }
  const marker = inlineValue.trim();
  if (/^[>|][-+]?$/u.test(marker)) {
    const separator = marker.startsWith('|') ? '\n' : ' ';
    return { value: continuation.join(separator).trim(), nextIndex: index };
  }
  return {
    value: [unquote(inlineValue), ...continuation].filter(Boolean).join(' ').trim(),
    nextIndex: index,
  };
}

export function parseSkillFrontmatter(markdown: string): ParsedSkillFrontmatter | null {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const metadata: Record<string, string> = {};
  let closingLine = -1;
  let index = 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '---') {
      closingLine = index;
      break;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      index += 1;
      continue;
    }
    const parsed = metadataValue(lines, index, match[2] ?? '');
    metadata[match[1]] = parsed.value;
    index = parsed.nextIndex;
  }
  if (closingLine < 0) return null;
  const name = String(metadata.name ?? '').trim();
  if (!name) return null;
  return {
    name,
    description: String(metadata.description ?? '').trim(),
    body: lines.slice(closingLine + 1).join('\n'),
    closingLine,
  };
}

export function skillRevision(markdown: string): string {
  return createHash('sha256').update(markdown).digest('hex');
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

function sourceEditability(skillFile: string, root: SkillRoot): { editable: boolean; readOnlyReason: string | null } {
  if (root.source === 'user') return { editable: false, readOnlyReason: 'User skills are read-only.' };
  if (root.source === 'system') return { editable: false, readOnlyReason: 'System skills are read-only.' };
  if (root.source === 'plugin') return { editable: false, readOnlyReason: 'Plugin skills are read-only.' };
  if (root.source === 'server' && existsSync(resolve(skillFile, '..', importedFederatedSkillMarker))) {
    return { editable: false, readOnlyReason: 'Imported federated skills are read-only on this node.' };
  }
  try {
    const canonicalRoot = realpathSync(root.directory);
    const canonicalFile = realpathSync(skillFile);
    if (isInside(canonicalRoot, canonicalFile)) return { editable: true, readOnlyReason: null };
  } catch {
    // The skill remains visible but cannot cross the verified write boundary.
  }
  return { editable: false, readOnlyReason: 'Skill path resolves outside an editable root.' };
}

function readSkillSummary(skillFile: string, root: SkillRoot): CodexSkillSummary | null {
  try {
    if (!statSync(skillFile).isFile()) return null;
    const markdown = readFileSync(skillFile, 'utf8');
    const metadata = parseSkillFrontmatter(markdown);
    if (!metadata) return null;
    return {
      name: metadata.name,
      description: metadata.description,
      source: root.source,
      ...sourceEditability(skillFile, root),
      revision: skillRevision(markdown),
      skillFile,
    };
  } catch {
    return null;
  }
}

export function scanCodexSkills(input: { workspaceRoot: string; serverRoot?: string }): CodexSkillSummary[] {
  const byName = new Map<string, CodexSkillSummary>();
  for (const root of candidateSkillRoots(input.workspaceRoot, input.serverRoot)) {
    for (const skillFile of collectSkillFiles(root)) {
      const summary = readSkillSummary(skillFile, root);
      if (!summary || byName.has(summary.name)) continue;
      byName.set(summary.name, summary);
    }
  }
  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}
