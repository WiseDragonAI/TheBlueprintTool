/**
 * WHAT: Classifies Git-visible text files and renders compact or queryable repository maps.
 * WHY: Pipeline gates need a small code overview while agents need exact maps on demand.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const maximumGitOutputBytes = 8 * 1024 * 1024;
const maximumMeaningfulPaths = 10_000;
const gitEnumerationTimeoutMs = 5_000;
const injectedFilesPerDirectory = 5;

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
  '.adoc', '.avsc', '.c', '.cc', '.conf', '.cpp', '.css', '.cxx', '.dart', '.go',
  '.gql', '.graphql', '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json', '.jsx',
  '.kt', '.kts', '.lua', '.md', '.mdx', '.mjs', '.mts', '.php', '.prisma',
  '.properties', '.proto', '.py', '.rb', '.rs', '.rst', '.scss', '.sh', '.sql',
  '.svelte', '.swift', '.thrift', '.toml', '.ts', '.tsx', '.txt', '.vue', '.xml',
  '.yaml', '.yml', '.zsh',
]);

const documentationExtensionNames = new Set(['.adoc', '.md', '.mdx', '.rst', '.txt']);

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

const kindAliases = new Map([
  ['c', 'code'],
  ['code', 'code'],
  ['t', 'test'],
  ['test', 'test'],
  ['d', 'doc'],
  ['doc', 'doc'],
]);

const kindCodes = new Map([
  ['code', 'c'],
  ['test', 't'],
  ['doc', 'd'],
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function displaySegment(segment) {
  return JSON.stringify(segment).slice(1, -1).replace(/[^\x20-\x7e]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function isMeaningfulPath(path) {
  const segments = path.split('/');
  if (segments.some((segment, index) =>
    index < segments.length - 1
    && (excludedDirectoryNames.has(segment) || segment.startsWith('.decision-os-')))) return false;
  const name = basename(path);
  if (excludedFileNames.has(name)) return false;
  if (/\.min\.(?:css|js)$/.test(name) || /\.map$/.test(name) || /(?:^|[-_.])license(?:[-_.]|$)/i.test(name)) return false;
  return meaningfulExactFileNames.has(name) || meaningfulExtensionNames.has(extname(name).toLowerCase());
}

export function fileMapKind(path) {
  const segments = path.split('/');
  const name = segments.at(-1);
  if (
    segments.slice(0, -1).some((segment) => /^(?:tests?|fixtures?)(?:[-_].*)?$/.test(segment))
    || /(?:^|[.-])(?:test|spec)\.[^.]+$/.test(name)
  ) return 'test';
  if (documentationExtensionNames.has(extname(name).toLowerCase())) return 'doc';
  return 'code';
}

export function meaningfulGitPaths(workspaceRoot) {
  const gitPaths = (args) =>
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

export function createFileMapInventory(workspaceRoot) {
  return meaningfulGitPaths(workspaceRoot)
    .slice(0, maximumMeaningfulPaths)
    .map((path) => ({ kind: fileMapKind(path), path }));
}

export function fileMapDomains(inventory) {
  const domains = new Map();
  for (const item of inventory) {
    const [domain, child] = item.path.split('/');
    if (!child) continue;
    let kinds = domains.get(domain);
    if (!kinds) {
      kinds = new Set();
      domains.set(domain, kinds);
    }
    kinds.add(item.kind);
  }
  return [...domains.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([name, kinds]) => ({
      name,
      codes: ['code', 'test', 'doc'].filter((kind) => kinds.has(kind)).map((kind) => kindCodes.get(kind)).join(''),
    }));
}

function lineCount(workspaceRoot, path) {
  try {
    const content = readFileSync(join(workspaceRoot, path));
    if (content.length === 0) return 0;
    let lines = content.at(-1) === 10 ? 0 : 1;
    for (const byte of content) if (byte === 10) lines += 1;
    return lines;
  } catch {
    return 0;
  }
}

function renderInventoryMap(workspaceRoot, inventory, kind, domain, maximumFiles) {
  const root = { directories: new Map(), files: [] };
  const selected = inventory.filter((item) =>
    item.kind === kind && (!domain || item.path === domain || item.path.startsWith(`${domain}/`)));
  for (const item of selected) {
    const segments = item.path.split('/');
    const fileName = segments.pop();
    let node = root;
    for (const segment of segments) {
      let child = node.directories.get(segment);
      if (!child) {
        child = { directories: new Map(), files: [] };
        node.directories.set(segment, child);
      }
      node = child;
    }
    node.files.push({
      lines: lineCount(workspaceRoot, item.path),
      name: fileName,
    });
  }
  const renderNode = (node, depth) => {
    const files = [...node.files]
      .sort((left, right) => right.lines - left.lines || compareText(left.name, right.name))
      .slice(0, maximumFiles)
      .map((file) => `${' '.repeat(depth)}${displaySegment(file.name)}`);
    const directories = [...node.directories.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .flatMap(([name, child]) => [
        `${' '.repeat(depth)}${displaySegment(name)}/`,
        ...renderNode(child, depth + 1),
      ]);
    return [...files, ...directories];
  };
  const lines = renderNode(root, 1);
  return lines.length === 0 ? '.\n (no matching files)' : ['.', ...lines].join('\n');
}

export function resolveFileMapKind(value) {
  return kindAliases.get(value) ?? '';
}

export function buildQueryFileMap(workspaceRoot, kindValue, domain = '') {
  const kind = resolveFileMapKind(kindValue);
  if (!kind) throw new Error('usage: tools/map.mjs <c|t|d> [domain]');
  const inventory = createFileMapInventory(workspaceRoot);
  const domains = fileMapDomains(inventory);
  if (domain && !domains.some((entry) => entry.name === domain)) {
    throw new Error(`unknown domain: ${domain}`);
  }
  return renderInventoryMap(workspaceRoot, inventory, kind, domain, Number.POSITIVE_INFINITY);
}

export function buildInjectedFileMap(workspaceRoot) {
  const inventory = createFileMapInventory(workspaceRoot);
  const domains = fileMapDomains(inventory);
  return [
    'DOMAINS',
    ...(domains.length === 0 ? [' (none)'] : domains.map(({ name, codes }) => ` ${displaySegment(name)} ${codes}`)),
    'QUERY',
    ' tools/map.mjs <c|t|d> [domain]',
    ' c=code t=test d=doc; domain optional; CODE=top5/dir by LOC',
    'CODE',
    renderInventoryMap(workspaceRoot, inventory, 'code', '', injectedFilesPerDirectory),
  ].join('\n');
}
