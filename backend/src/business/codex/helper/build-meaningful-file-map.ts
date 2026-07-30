/**
 * WHAT: Builds a deterministic tree of Git-visible source and documentation files.
 * WHY: Pipeline prompts need repository structure without ignored runtime data, generated output, or binary assets.
 */
import { execFileSync } from 'node:child_process';
import { basename, extname } from 'node:path';

type FileMapNode = {
  children: Map<string, FileMapNode>;
  file: boolean;
};

const maximumGitOutputBytes = 8 * 1024 * 1024;
const maximumMeaningfulPaths = 10_000;
const gitEnumerationTimeoutMs = 5_000;

const excludedDirectoryNames = new Set([
  '.cache',
  '.codex',
  '.decision-os',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.skills',
  '.worktrees',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'out',
  'target',
  'tmp',
  'vendor',
]);

const excludedFileNames = new Set([
  'Cargo.lock',
  'composer.lock',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'poetry.lock',
  'yarn.lock',
]);

const meaningfulExtensionNames = new Set([
  '.adoc',
  '.avsc',
  '.c',
  '.cc',
  '.conf',
  '.cpp',
  '.css',
  '.cxx',
  '.dart',
  '.go',
  '.gql',
  '.graphql',
  '.h',
  '.hpp',
  '.html',
  '.ini',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.kts',
  '.lua',
  '.md',
  '.mdx',
  '.mjs',
  '.mts',
  '.php',
  '.prisma',
  '.properties',
  '.proto',
  '.py',
  '.rb',
  '.rs',
  '.rst',
  '.scss',
  '.sh',
  '.sql',
  '.svelte',
  '.swift',
  '.thrift',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh',
]);

const meaningfulExactFileNames = new Set([
  '.editorconfig',
  '.eslintrc',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.prettierrc',
  'CMakeLists.txt',
  'Dockerfile',
  'Makefile',
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function displaySegment(segment: string): string {
  return JSON.stringify(segment).slice(1, -1).replace(/[^\x20-\x7e]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function isMeaningfulPath(path: string): boolean {
  const segments = path.split('/');
  if (segments.some((segment, index) =>
    index < segments.length - 1
    && (excludedDirectoryNames.has(segment) || segment.startsWith('.decision-os-')))) return false;
  const name = basename(path);
  if (excludedFileNames.has(name)) return false;
  if (/\.min\.(?:css|js)$/.test(name) || /\.map$/.test(name) || /(?:^|[-_.])license(?:[-_.]|$)/i.test(name)) return false;
  return meaningfulExactFileNames.has(name) || meaningfulExtensionNames.has(extname(name).toLowerCase());
}

function insertPath(root: FileMapNode, path: string): void {
  const segments = path.split('/').filter(Boolean);
  let node = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    let child = node.children.get(segment);
    if (!child) {
      child = { children: new Map(), file: false };
      node.children.set(segment, child);
    }
    if (index === segments.length - 1) child.file = true;
    node = child;
  }
}

function renderChildren(node: FileMapNode, depth: number): string[] {
  const entries = [...node.children.entries()].sort(([left], [right]) => compareText(left, right));
  return entries.flatMap(([name, child]) => {
    const line = `${' '.repeat(depth)}${displaySegment(name)}${child.file ? '' : '/'}`;
    return [line, ...renderChildren(child, depth + 1)];
  });
}

export function meaningfulGitPaths(workspaceRoot: string): string[] {
  const gitPaths = (args: string[]): string[] =>
    execFileSync('git', args, {
      cwd: workspaceRoot,
      encoding: 'buffer',
      timeout: gitEnumerationTimeoutMs,
      maxBuffer: maximumGitOutputBytes,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8').split('\0').filter(Boolean);
  const deleted = new Set(gitPaths(['ls-files', '--deleted', '-z']));
  return gitPaths(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .filter((path) => !deleted.has(path))
    .filter(isMeaningfulPath)
    .sort(compareText);
}

export function buildMeaningfulFileMap(workspaceRoot: string): string {
  try {
    const paths = meaningfulGitPaths(workspaceRoot);
    if (paths.length === 0) return '.\n (no meaningful code or documentation files)';
    const retained = paths.slice(0, maximumMeaningfulPaths);
    const root: FileMapNode = { children: new Map(), file: false };
    for (const path of retained) insertPath(root, path);
    const tree = ['.', ...renderChildren(root, 1)];
    if (paths.length > retained.length) tree.push(`... ${paths.length - retained.length} additional meaningful paths omitted.`);
    return tree.join('\n');
  } catch {
    return '.\n (file map unavailable: Git could not enumerate this workspace)';
  }
}
