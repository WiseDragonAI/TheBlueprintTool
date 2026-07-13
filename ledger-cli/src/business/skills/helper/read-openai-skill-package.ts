/**
 * WHAT: Validates and loads one OpenAI-format skill package without following links.
 * WHY: Server skill synchronization must reject ambiguous packages before touching ledger or Git state.
 */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';

export type SkillPackageFile = { absolutePath: string; content: Buffer; mode: number; relativePath: string };

export type OpenAiSkillPackage = {
  description: string;
  files: SkillPackageFile[];
  name: string;
  references: Array<SkillPackageFile & { text: string }>;
  skillMarkdown: string;
  sourceRoot: string;
};

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function collectFiles(root: string, directory = root): SkillPackageFile[] {
  const files: SkillPackageFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = resolve(directory, entry.name);
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink()) throw new Error(`Skill packages cannot contain symlinks: ${relative(root, absolutePath)}`);
    if (metadata.isDirectory()) files.push(...collectFiles(root, absolutePath));
    else if (metadata.isFile()) files.push({ absolutePath, content: readFileSync(absolutePath), mode: metadata.mode & 0o777, relativePath: relative(root, absolutePath).split('\\').join('/') });
    else throw new Error(`Skill packages can contain only regular files and directories: ${relative(root, absolutePath)}`);
  }
  return files;
}

function frontmatter(markdown: string): { description: string; name: string } {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0] !== '---') throw new Error('SKILL.md must start with YAML frontmatter.');
  const closing = lines.indexOf('---', 1);
  if (closing < 0) throw new Error('SKILL.md frontmatter is not closed.');
  const metadata: Record<string, string> = {};
  for (let index = 1; index < closing; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (/^[>|][-+]?$/u.test(value)) {
      const parts: string[] = [];
      while (index + 1 < closing && /^\s+\S/.test(lines[index + 1])) parts.push(lines[++index].trim());
      value = parts.join(value.startsWith('|') ? '\n' : ' ');
    }
    metadata[key] = value;
  }
  const extra = Object.keys(metadata).filter((key) => key !== 'name' && key !== 'description');
  if (extra.length > 0) throw new Error(`SKILL.md frontmatter supports only name and description; found ${extra.join(', ')}.`);
  const name = String(metadata.name ?? '').trim();
  const description = String(metadata.description ?? '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error('Skill name must be lowercase hyphen-case and at most 64 characters.');
  if (!description) throw new Error('SKILL.md requires a non-empty description.');
  return { name, description };
}

function utf8(file: SkillPackageFile): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(file.content);
  } catch {
    throw new Error(`Reference cards require UTF-8 text files: ${file.relativePath}`);
  }
}

function validateOpenAiYaml(file: SkillPackageFile | undefined): void {
  if (!file) throw new Error('Skill package requires agents/openai.yaml.');
  const yaml = utf8(file);
  if (!/^interface:\s*$/m.test(yaml)) throw new Error('agents/openai.yaml requires an interface mapping.');
  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    if (!new RegExp(`^\\s+${field}:\\s*\\S`, 'm').test(yaml)) throw new Error(`agents/openai.yaml requires interface.${field}.`);
  }
}

function validateMarkdownLinks(input: { markdown: string; sourceRoot: string; files: SkillPackageFile[] }): void {
  const available = new Set(input.files.map((file) => file.relativePath));
  for (const match of input.markdown.matchAll(/\]\(([^)]+)\)/g)) {
    const raw = String(match[1] ?? '').trim().replace(/^<|>$/g, '').split(/\s+["']/)[0];
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw) || isAbsolute(raw)) continue;
    const withoutAnchor = decodeURIComponent(raw.split('#')[0]).split('?')[0];
    const absolute = resolve(input.sourceRoot, withoutAnchor);
    if (!inside(input.sourceRoot, absolute)) throw new Error(`SKILL.md link escapes the skill package: ${raw}`);
    const packagePath = relative(input.sourceRoot, absolute).split('\\').join('/');
    if (!available.has(packagePath)) throw new Error(`SKILL.md references a missing package file: ${packagePath}`);
  }
}

export function readOpenAiSkillPackage(source: string): OpenAiSkillPackage {
  const sourceRoot = resolve(source);
  const sourceMetadata = lstatSync(sourceRoot);
  if (sourceMetadata.isSymbolicLink() || !sourceMetadata.isDirectory()) throw new Error('Skill source must be a regular directory, not a symlink.');
  const files = collectFiles(sourceRoot);
  const skillFile = files.find((file) => file.relativePath === 'SKILL.md');
  if (!skillFile) throw new Error('Skill package requires SKILL.md.');
  const skillMarkdown = utf8(skillFile);
  const metadata = frontmatter(skillMarkdown);
  if (basename(sourceRoot) !== metadata.name) throw new Error('Skill directory name must match SKILL.md name.');
  validateOpenAiYaml(files.find((file) => file.relativePath === 'agents/openai.yaml'));
  validateMarkdownLinks({ markdown: skillMarkdown, sourceRoot, files });
  const references = files
    .filter((file) => file.relativePath.startsWith('references/'))
    .map((file) => ({ ...file, text: utf8(file) }));
  return { ...metadata, files, references, skillMarkdown, sourceRoot };
}
