#!/usr/bin/env node
/**
 * WHAT: Maps the current codebase filesystem and queries AST control-flow rationale along source stack frames.
 * WHY: Agents need a Git-independent static companion to Trace Evidence for understanding what calls what and why each branch exists.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { buildQualityMap } from '../src/business/quality-map/controller/build-quality-map.js';
import { runQualityGraphify } from '../src/business/quality-map/effect/run-quality-graphify.js';
import type { QualityMap } from '../src/business/quality-map/types.js';
import { inventoryFiles } from '../src/business/quality-map/helper/inventory-files.js';
import { projectStack } from '../src/business/quality-map/helper/project-stack.js';

const GRAPHIFY_CODE_PATTERN = /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|rs|java|kt|kts|cs|cpp|cc|c|h|hpp)$/i;

function option(name: string, fallback = ''): string {
  const index = process.argv.indexOf(`--${name}`);
  return /* WHAT: Return the supplied option value. WHY: Absent options must use their declared fallback. */ index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function options(name: string): string[] {
  const results: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    // WHAT: Collect each repeated option value in caller order.
    // WHY: Filesystem exclusions require more than one explicit directory name.
    if (process.argv[index] === `--${name}` && process.argv[index + 1]) results.push(process.argv[index + 1]);
  }
  return results;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function renderMarkdown(report: QualityMap): string {
  const applicable = report.files.filter((file) => file.applicable);
  const lines = ['# Codebase Quality Map', '', `Root: \`${report.root}\``, '', `Filesystem files: ${report.files.length}`, `Applicable source files: ${applicable.length}`, `Functions: ${applicable.reduce((count, file) => count + file.functions.length, 0)}`, `Findings: ${report.findings.length}`, '', '## Files', ''];
  for (const file of applicable) {
    const coverage = /* WHAT: Render unknown coverage distinctly. WHY: Missing instrumentation is not zero execution. */ file.lineCoverage === null ? 'unknown' : `${file.lineCoverage.toFixed(2)}%`;
    lines.push(`- \`${file.path}\` — ${file.role}; ${file.loc} LOC; ${file.functions.length} functions; ${file.findings.length} findings; coverage ${coverage}`);
  }
  return `${lines.join('\n')}\n`;
}

async function analyze(): Promise<void> {
  const root = resolve(option('root', option('repo', process.cwd())));
  const exclusions = options('exclude');
  const output = resolve(option('output', join(root, '.trace', 'quality-map', `run-${Date.now()}`)));
  mkdirSync(output, { recursive: true });
  const temporary = mkdtempSync(join(tmpdir(), 'quality-map-'));
  const corpus = join(temporary, 'corpus');
  mkdirSync(corpus);
  try {
    const inventory = inventoryFiles(root, exclusions);
    for (const file of inventory.files) {
      // WHAT: Copy only supported code files into the isolated Graphify corpus.
      // WHY: Static extraction must not ingest credentials, authored prose, runtime data, or external symlink targets.
      if (file.exclusion || !GRAPHIFY_CODE_PATTERN.test(file.path)) continue;
      const destination = join(corpus, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(join(root, file.path), destination);
    }
    const suppliedGraph = option('graph');
    const graphPath = /* WHAT: Reuse explicit graph evidence when supplied. WHY: Tests and cached analyses must not rerun Graphify. */ suppliedGraph ? resolve(suppliedGraph) : await runQualityGraphify(corpus, output, Number(option('graphify-timeout-ms', '900000')));
    const lcov = option('lcov');
    const report = buildQualityMap({ root, graphPath, exclusions, lcovPath: /* WHAT: Join only an explicit coverage artifact. WHY: Missing coverage must remain unknown. */ lcov ? resolve(lcov) : undefined });
    const reportPath = join(output, 'quality-map.json');
    const markdownPath = join(output, 'quality-map.md');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(markdownPath, renderMarkdown(report));
    // WHAT: Retain a supplied graph beside the normalized report.
    // WHY: Every quality-map artifact must remain inspectable after temporary snapshot cleanup.
    if (suppliedGraph) cpSync(graphPath, join(output, 'graph.json'));
    const retainedGraph = /* WHAT: Inventory the copied graph for supplied evidence. WHY: Generated Graphify output already resides under the job directory. */ suppliedGraph ? join(output, 'graph.json') : graphPath;
    const artifacts = [reportPath, markdownPath, retainedGraph].map((path) => ({ path: relative(output, path).replaceAll('\\', '/'), bytes: readFileSync(path).byteLength, sha256: sha256(path) }));
    writeFileSync(join(output, 'manifest.json'), `${JSON.stringify({ version: 1, scope: 'filesystem', root, graphify: { package: 'graphifyy', version: '0.9.22', license: 'MIT' }, artifacts }, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ scope: 'filesystem', root, output, report: reportPath, files: report.files.length, functions: report.files.reduce((count, file) => count + file.functions.length, 0), findings: report.findings.length }, null, 2)}\n`);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function queryStack(): void {
  const report = JSON.parse(readFileSync(resolve(option('report')), 'utf8')) as QualityMap;
  const stackFile = option('stack-file');
  const stack = /* WHAT: Prefer complete stack bytes from an explicit file. WHY: Multiline shell arguments are a secondary convenience. */ stackFile ? readFileSync(resolve(stackFile), 'utf8') : option('stack');
  process.stdout.write(`${JSON.stringify(projectStack(report, stack), null, 2)}\n`);
}

function queryFile(): void {
  const report = JSON.parse(readFileSync(resolve(option('report')), 'utf8')) as QualityMap;
  const path = option('path').replaceAll('\\', '/');
  const file = report.files.find((candidate) => candidate.path === path);
  // WHAT: Reject an unknown file query explicitly.
  // WHY: Empty output could be mistaken for a compliant file with no functions.
  if (!file) throw new Error(`quality_map_file_not_found:${path}`);
  process.stdout.write(`${JSON.stringify(file, null, 2)}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';
  // WHAT: Build the complete static map only for the analyze command.
  // WHY: Read-only queries must never rerun Graphify or alter artifacts.
  if (command === 'analyze') { await analyze(); return; }
  // WHAT: Project stack frames onto AST functions, branches, comments, coverage, and graph edges.
  // WHY: This is the direct static link from Trace Evidence stacks to logical control flow.
  if (command === 'stack') { queryStack(); return; }
  // WHAT: Return one complete file record for focused agent inspection.
  // WHY: Agents should not scan the full repository report for one source owner.
  if (command === 'file') { queryFile(); return; }
  process.stdout.write('Usage:\n  codebase-quality-map analyze --root <path> [--exclude <directory-name>]... [--output <path>] [--lcov <path>] [--graph <graph.json>]\n  codebase-quality-map stack --report <quality-map.json> (--stack <text> | --stack-file <path>)\n  codebase-quality-map file --report <quality-map.json> --path <codebase-relative-path>\n');
}

main().catch((error) => {
  const message = /* WHAT: Preserve Error messages and stringify non-Error failures. WHY: Every CLI failure needs readable settlement evidence. */ error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
