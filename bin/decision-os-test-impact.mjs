#!/usr/bin/env node
/**
 * WHAT: Selects tests changed by a commit series plus tests statically dependent on changed code.
 * WHY: Commit verification needs a deterministic test scope before test execution begins.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GRAPHIFY_PACKAGE = 'graphifyy';
const GRAPHIFY_VERSION = '0.9.22';
const GRAPHIFY_LICENSE = 'MIT';
const CODE_PATTERN = /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|rs|java|kt|kts|cs|cpp|cc|c|h|hpp)$/i;
const TEST_PATTERNS = [/(?:^|\/)tests?\//i, /(?:^|\/)src\/test\//i, /(?:^|\/)test-responsive\//i, /\.(?:test|spec)\.[^.\/]+$/i];

function run(cwd, command, args, timeout = 120_000) {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 100 * 1024 * 1024 }).trim();
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
  }
}

function git(root, args) {
  return run(root, 'git', args);
}

function repositoryPath(value) {
  return normalize(String(value ?? '').replaceAll('\\', '/')).split(sep).join('/').replace(/^\.\//, '');
}

export function isTestFile(path) {
  const normalized = repositoryPath(path);
  return TEST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function parseNameStatus(output) {
  const changes = [];
  for (const line of String(output ?? '').split('\n')) {
    // WHAT: Ignore the terminal empty line emitted by Git output.
    // WHY: It does not describe a changed repository path.
    if (!line.trim()) continue;
    const [statusToken, firstPath, secondPath] = line.split('\t');
    const status = statusToken[0];
    // WHAT: Preserve both sides of renames and copies while selecting the destination path.
    // WHY: Dependency analysis targets files that exist in the final commit snapshot.
    if (status === 'R' || status === 'C') {
      changes.push({ status, path: repositoryPath(secondPath), oldPath: repositoryPath(firstPath) });
      continue;
    }
    changes.push({ status, path: repositoryPath(firstPath), oldPath: '' });
  }
  return changes;
}

export function buildFileDependencyGraph(graph) {
  const nodeFiles = new Map();
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    const sourceFile = repositoryPath(node?.source_file);
    // WHAT: Index only nodes owned by repository files.
    // WHY: External reference nodes cannot identify runnable repository tests.
    if (node?.id && sourceFile) nodeFiles.set(String(node.id), sourceFile);
  }
  const dependencies = new Map();
  const files = new Set(nodeFiles.values());
  for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
    const dependent = nodeFiles.get(String(edge?.source ?? ''));
    const dependency = nodeFiles.get(String(edge?.target ?? ''));
    // WHAT: Collapse only cross-file relationships into the file dependency graph.
    // WHY: Same-file containment does not establish impact between test and source files.
    if (!dependent || !dependency || dependent === dependency) continue;
    const targets = dependencies.get(dependent) ?? new Set();
    targets.add(dependency);
    dependencies.set(dependent, targets);
  }
  return { files, dependencies };
}

export function selectImpactedTests({ changedPaths, changedTests = [], fileGraph }) {
  const reverse = new Map();
  for (const [dependent, dependencies] of fileGraph.dependencies) {
    for (const dependency of dependencies) {
      const dependents = reverse.get(dependency) ?? new Set();
      dependents.add(dependent);
      reverse.set(dependency, dependents);
    }
  }
  const queue = [];
  const paths = new Map();
  for (const changedPath of changedPaths) {
    queue.push(changedPath);
    paths.set(changedPath, [changedPath]);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const dependency = queue[index];
    for (const dependent of reverse.get(dependency) ?? []) {
      // WHAT: Visit each dependent file once through its shortest discovered path.
      // WHY: Cyclic imports must terminate and reasons should remain compact.
      if (paths.has(dependent)) continue;
      paths.set(dependent, [...paths.get(dependency), dependent]);
      queue.push(dependent);
    }
  }
  const directlyChanged = new Set(changedTests);
  const selected = new Set(changedTests);
  for (const file of paths.keys()) {
    // WHAT: Select only repository test files reached through reverse dependencies.
    // WHY: Production dependents explain propagation but are not executable test targets.
    if (isTestFile(file)) selected.add(file);
  }
  return [...selected].sort().map((file) => ({
    file,
    reason: directlyChanged.has(file) ? 'changed' : 'dependency',
    path: directlyChanged.has(file) ? [file] : [...paths.get(file)].reverse(),
  }));
}

function resolveCommits(root, inputs) {
  const commits = inputs.map((input) => ({ input, hash: git(root, ['rev-parse', '--verify', `${input}^{commit}`]) }));
  for (let index = 1; index < commits.length; index += 1) {
    let ancestor = true;
    try {
      git(root, ['merge-base', '--is-ancestor', commits[index - 1].hash, commits[index].hash]);
    } catch {
      ancestor = false;
    }
    // WHAT: Require the supplied order to form one forward commit series.
    // WHY: One final snapshot cannot represent unrelated branch histories deterministically.
    if (!ancestor) throw new Error(`Commits are not an ordered series: ${commits[index - 1].input} -> ${commits[index].input}`);
  }
  return commits;
}

function changesForCommit(root, hash) {
  const parents = git(root, ['rev-list', '--parents', '-n', '1', hash]).split(/\s+/).slice(1);
  // WHAT: Diff merge commits against their first parent.
  // WHY: The CLI reports the change introduced along the selected series lineage.
  if (parents.length > 0) return parseNameStatus(git(root, ['diff', '--name-status', '-M', parents[0], hash]));
  return parseNameStatus(git(root, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', hash]));
}

function graphifyCommand() {
  const configured = process.env.DECISION_OS_TEST_IMPACT_GRAPHIFY_COMMAND?.trim();
  // WHAT: Use an explicitly configured direct argv when supplied.
  // WHY: CI can pin a preinstalled executable without introducing a shell boundary.
  if (configured) {
    const parsed = JSON.parse(configured);
    // WHAT: Reject malformed executable configuration before process creation.
    // WHY: An empty command cannot produce trustworthy graph evidence.
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((value) => typeof value !== 'string' || !value)) throw new Error('Invalid DECISION_OS_TEST_IMPACT_GRAPHIFY_COMMAND.');
    return parsed;
  }
  return ['uvx', '--from', `${GRAPHIFY_PACKAGE}==${GRAPHIFY_VERSION}`, 'graphify'];
}

function extractSnapshot(root, tip, temporaryRoot) {
  const archive = join(temporaryRoot, 'repository.tar');
  const snapshot = join(temporaryRoot, 'snapshot');
  run(root, 'mkdir', ['-p', snapshot]);
  git(root, ['archive', '--format=tar', '--output', archive, tip]);
  run(root, 'tar', ['-xf', archive, '-C', snapshot]);
  return snapshot;
}

function extractGraph(root, tip, temporaryRoot) {
  const snapshot = extractSnapshot(root, tip, temporaryRoot);
  const output = join(temporaryRoot, 'graph');
  const command = graphifyCommand();
  run(root, command[0], [...command.slice(1), 'extract', snapshot, '--output', output, '--force', '--code-only', '--no-cluster', '--no-gitignore'], 10 * 60_000);
  const graphPath = join(output, 'graphify-out', 'graph.json');
  // WHAT: Require Graphify's machine artifact after successful process settlement.
  // WHY: stdout cannot substitute for the dependency graph contract.
  if (!existsSync(graphPath)) throw new Error(`Graphify did not create ${graphPath}.`);
  return { graphPath, snapshot };
}

function parseArguments(argv) {
  const options = { repository: process.cwd(), graphPath: '', json: false, help: false, commits: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    // WHAT: Record boolean flags without consuming a commit argument.
    // WHY: Output selection and help have no values.
    if (argument === '--json' || argument === '--help') {
      options[argument === '--json' ? 'json' : 'help'] = true;
      continue;
    }
    // WHAT: Consume valued options through one explicit boundary.
    // WHY: Repository and graph paths must not be mistaken for commit selectors.
    if (argument === '--repo' || argument === '--graph') {
      const value = argv[index + 1];
      // WHAT: Reject a missing option value before repository operations.
      // WHY: Falling back to the current directory would analyze the wrong scope.
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      options[argument === '--repo' ? 'repository' : 'graphPath'] = value;
      index += 1;
      continue;
    }
    // WHAT: Reject unknown flags while accepting Git revision arguments.
    // WHY: A misspelled option must not become a revision lookup.
    if (argument.startsWith('--')) throw new Error(`Unknown option: ${argument}`);
    options.commits.push(argument);
  }
  return options;
}

function usage() {
  return [
    'Usage: decision-os-test-impact [options] <commit> [<commit> ...]',
    '',
    'Options:',
    '  --repo <path>   Git repository root (default: cwd)',
    '  --graph <path>  Use an existing Graphify graph.json',
    '  --json          Print the machine-readable report',
    '  --help          Print this help',
  ].join('\n');
}

export function analyzeCommitImpact({ repository, commitInputs, graphPath = '' }) {
  const root = resolve(repository);
  git(root, ['rev-parse', '--show-toplevel']);
  const commits = resolveCommits(root, commitInputs);
  // WHAT: Require at least one exact commit selector.
  // WHY: An empty series has no defined change boundary.
  if (commits.length === 0) throw new Error('At least one commit is required.');
  const commitChanges = commits.map((commit) => ({ ...commit, changes: changesForCommit(root, commit.hash) }));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'decision-os-test-impact-'));
  try {
    const extracted = graphPath ? { graphPath: resolve(root, graphPath), snapshot: '' } : extractGraph(root, commits.at(-1).hash, temporaryRoot);
    const graph = JSON.parse(readFileSync(extracted.graphPath, 'utf8'));
    const fileGraph = buildFileDependencyGraph(graph);
    const allChanges = commitChanges.flatMap((commit) => commit.changes);
    const finalPaths = new Set(fileGraph.files);
    const changedTests = [...new Set(allChanges.filter((change) => change.status !== 'D' && isTestFile(change.path) && finalPaths.has(change.path)).map((change) => change.path))].sort();
    const deletedTests = [...new Set(allChanges.flatMap((change) => change.status === 'D' && isTestFile(change.path) ? [change.path] : []))].sort();
    const changedCodeFiles = [...new Set(allChanges.filter((change) => change.status !== 'D' && CODE_PATTERN.test(change.path) && !isTestFile(change.path) && finalPaths.has(change.path)).map((change) => change.path))].sort();
    const selectedTests = selectImpactedTests({ changedPaths: changedCodeFiles, changedTests, fileGraph });
    const mapped = new Set([...changedTests, ...changedCodeFiles]);
    const unmappedChangedFiles = [...new Set(allChanges.filter((change) => change.status !== 'D' && !mapped.has(change.path)).map((change) => change.path))].sort();
    return {
      version: 1,
      repository: root,
      graphify: { package: GRAPHIFY_PACKAGE, version: GRAPHIFY_VERSION, license: GRAPHIFY_LICENSE },
      tip: commits.at(-1).hash,
      commits: commitChanges,
      changedTests,
      affectedTests: selectedTests.filter((test) => test.reason === 'dependency').map((test) => test.file),
      selectedTests,
      deletedTests,
      changedCodeFiles,
      unmappedChangedFiles,
    };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function formatReport(report) {
  const lines = [`Tip: ${report.tip}`, '', 'Selected tests:'];
  lines.push(...(report.selectedTests.length ? report.selectedTests.map((test) => `  ${test.file} [${test.reason}]${test.reason === 'dependency' ? `\n    ${test.path.join(' -> ')}` : ''}`) : ['  none']));
  lines.push('', 'Unmapped changed files:', ...(report.unmappedChangedFiles.length ? report.unmappedChangedFiles.map((file) => `  ${file}`) : ['  none']));
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  // WHAT: Print help without resolving repository state.
  // WHY: CLI discovery must remain available outside a Git checkout.
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = analyzeCommitImpact({ repository: options.repository, commitInputs: options.commits, graphPath: options.graphPath });
  process.stdout.write(`${options.json ? JSON.stringify(report, null, 2) : formatReport(report)}\n`);
}

// WHAT: Execute only when this module owns the process entrypoint.
// WHY: Tests import pure graph helpers without triggering Git and Graphify processes.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
