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
  if (segments.slice(0, -1).some((segment) => /^(?:docs?|documentation)$/.test(segment))) return 'doc';
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

function renderInventoryMap(workspaceRoot, inventory, kind, baseDirectory, maximumFiles, maximumDepth) {
  const root = { directories: new Map(), files: [] };
  const selected = inventory.filter((item) =>
    item.kind === kind && (!baseDirectory || item.path.startsWith(`${baseDirectory}/`)));
  for (const item of selected) {
    const relativePath = baseDirectory ? item.path.slice(baseDirectory.length + 1) : item.path;
    const segments = relativePath.split('/');
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
  const renderNode = (node, indentation, currentDepth) => {
    // WHAT: Omit entries below the requested directory level.
    // WHY: A directory shown at the limit must not reveal its children.
    if (currentDepth >= maximumDepth) return [];
    const files = [...node.files]
      .sort((left, right) => right.lines - left.lines || compareText(left.name, right.name))
      .slice(0, maximumFiles)
      .map((file) => `${' '.repeat(indentation)}${displaySegment(file.name)}`);
    const directories = [...node.directories.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .flatMap(([name, child]) => [
        `${' '.repeat(indentation)}${displaySegment(name)}/`,
        ...renderNode(child, indentation + 1, currentDepth + 1),
      ]);
    return [...files, ...directories];
  };
  const lines = renderNode(root, 1, 0);
  // WHAT: Render the map root for a zero-depth query with matching files.
  // WHY: Depth zero intentionally exposes no entries, not an empty repository.
  if (lines.length === 0 && selected.length > 0 && maximumDepth === 0) return '.';
  return lines.length === 0 ? '.\n (no matching files)' : ['.', ...lines].join('\n');
}

export function resolveFileMapKind(value) {
  return kindAliases.get(value) ?? '';
}

function parseFileMapDepth(depthValue) {
  // WHAT: Preserve the existing unlimited query when no depth was provided.
  // WHY: Existing one-argument map invocations must retain their complete output.
  if (depthValue === undefined) return Number.POSITIVE_INFINITY;
  // WHAT: Reject non-integer depth values before rendering the map.
  // WHY: A depth limit has one deterministic, bounded interpretation.
  if (!/^(?:0|[1-9][0-9]*)$/.test(depthValue)) {
    throw new Error('depth must be a non-negative integer');
  }
  return Number(depthValue);
}

export function buildQueryFileMap(workspaceRoot, kindValue, baseDirectory = '', depthValue) {
  const kind = resolveFileMapKind(kindValue);
  // WHAT: Reject an unknown map kind before inspecting repository paths.
  // WHY: The CLI contract accepts only code, test, and documentation maps.
  if (!kind) throw new Error('usage: tools/map.mjs <c|t|d> [base-directory] [depth]');
  const inventory = createFileMapInventory(workspaceRoot);
  // WHAT: Require a supplied base directory to contain at least one meaningful repository path.
  // WHY: A typo must not be mistaken for an empty result.
  if (baseDirectory && !inventory.some((item) => item.path.startsWith(`${baseDirectory}/`))) {
    throw new Error(`unknown base directory: ${baseDirectory}`);
  }
  return renderInventoryMap(
    workspaceRoot,
    inventory,
    kind,
    baseDirectory,
    Number.POSITIVE_INFINITY,
    parseFileMapDepth(depthValue),
  );
}

export function buildInjectedFileMap(workspaceRoot) {
  const inventory = createFileMapInventory(workspaceRoot);
  const domains = fileMapDomains(inventory);
  return [
    'DOMAINS',
    ...(domains.length === 0 ? [' (none)'] : domains.map(({ name, codes }) => ` ${displaySegment(name)} ${codes}`)),
    'CODE',
    renderInventoryMap(
      workspaceRoot,
      inventory,
      'code',
      '',
      injectedFilesPerDirectory,
      Number.POSITIVE_INFINITY,
    ),
  ].join('\n');
}
