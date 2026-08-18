/**
 * WHAT: Builds one repository-wide static quality map from a pinned snapshot, Graphify graph, and optional LCOV.
 * WHY: Agents need one queryable artifact joining architecture, control-flow rationale, size, and coverage evidence.
 */
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { applyGraphify } from '../helper/normalize-graphify.js';
import { applyLcov } from '../helper/apply-lcov.js';
import { parseSourceFile } from '../helper/parse-source-file.js';
import type { QualityFile, QualityFileRole, QualityFinding, QualityMap } from '../types.js';

const SOURCE_PATTERN = /\.(?:[cm]?[jt]sx?)$/i;

function roleFor(path: string): QualityFileRole {
  // WHAT: Classify fixtures before their surrounding test directory.
  // WHY: Fixture files provide setup data rather than behavioral proof.
  if (/(?:^|\/)fixtures?\//i.test(path)) return 'fixture';
  // WHAT: Classify tests before production vocabulary.
  // WHY: Test paths may contain names such as controller and helper for their subject.
  if (/(?:^|\/)tests?\/|\.(?:test|spec)\./i.test(path)) return 'test';
  // WHAT: Use explicit architecture directories as the primary ownership evidence.
  // WHY: Decision OS and adopted repositories expose these Code Quality Gate roles in paths.
  if (/(?:^|\/)controller\//i.test(path)) return 'controller';
  // WHAT: Identify bounded implementation helpers by their ownership directory.
  // WHY: Helpers return implementation results to controllers.
  if (/(?:^|\/)helper\//i.test(path)) return 'helper';
  // WHAT: Identify final output effects by their ownership directory.
  // WHY: Effects represent observable output boundaries.
  if (/(?:^|\/)effect\//i.test(path)) return 'effect';
  // WHAT: Identify rendered components by their ownership directory.
  // WHY: Components own presentation fragments.
  if (/(?:^|\/)component\//i.test(path)) return 'component';
  // WHAT: Identify external input adapters and their nested owners.
  // WHY: Inputs begin the logical behavior chain.
  if (/(?:^|\/)input\//i.test(path)) return 'input';
  // WHAT: Identify typed action payload owners from stable path vocabulary.
  // WHY: Actions describe what entered a behavior before controller decisions.
  if (/(?:^|\/)actions?\//i.test(path)) return 'action';
  // WHAT: Identify composed screen and page presentation owners.
  // WHY: Screens and pages remain distinct from their rendered components.
  if (/(?:^|\/)(?:screens?|pages?)\//i.test(path)) return 'screen-page';
  // WHAT: Identify route transport boundaries from stable path vocabulary.
  // WHY: Routes translate external transport into application actions.
  if (/(?:^|\/)routes?\//i.test(path)) return 'route';
  // WHAT: Identify runtime state owners from stable path vocabulary.
  // WHY: State files hold transient values and transition ownership.
  if (/(?:^|\/)(?:state|store)\//i.test(path)) return 'state';
  // WHAT: Identify shared contracts and schemas before generic source fallback.
  // WHY: Contract files define data boundaries rather than behavior.
  if (/(?:^|\/)(?:schemas?|contracts?|types)\//i.test(path) || /(?:^|\/)(?:types|model)\.[^.]+$/i.test(path)) return 'contract';
  // WHAT: Identify executable entrypoints through their stable names.
  // WHY: Entrypoints start a root block and delegate behavior.
  if (/(?:^|\/)(?:index|main|server|cli)\.[^.]+$/i.test(path) || path.startsWith('bin/')) return 'entrypoint';
  return 'unclassified';
}

function languageFor(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
  const names: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', mts: 'typescript', cts: 'typescript' };
  return names[extension] ?? 'unknown';
}

function exclusionFor(path: string, snapshot: string): string | null {
  // WHAT: Mark Git submodules and directory gitlinks as explicit inventory boundaries.
  // WHY: Their contents belong to a separately pinned repository.
  if (lstatSync(resolve(snapshot, path)).isDirectory()) return 'submodule';
  // WHAT: Keep generated and vendored code visible without applying authored-source gates.
  // WHY: Generated outputs must be inventoried but corrected at their source owner.
  if (/(?:^|\/)(?:node_modules|dist|generated|vendor)\//i.test(path)) return 'generated-or-vendor';
  // WHAT: Keep non-JavaScript languages visible as unsupported adapter scope.
  // WHY: This first adapter must not pretend TypeScript AST rules parsed another language.
  if (!SOURCE_PATTERN.test(path)) return 'unsupported-language';
  return null;
}

function finding(code: string, path: string, line: number | null, symbolId: string | null, message: string): QualityFinding {
  return { code, path, line, symbolId, message };
}

export function buildQualityMap(input: { repository: string; snapshot: string; commit: string; graphPath: string; lcovPath?: string }): QualityMap {
  const tracked = execFileSync('git', ['-C', input.repository, 'ls-tree', '-r', '--name-only', '-z', input.commit], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }).split('\0').filter(Boolean).sort();
  const files: QualityFile[] = [];
  for (const path of tracked) {
    const absolute = resolve(input.snapshot, path);
    const exclusion = exclusionFor(path, input.snapshot);
    // WHAT: Inventory non-applicable paths without attempting text parsing.
    // WHY: Whole-codebase coverage requires explicit entries for submodules and unsupported files.
    if (exclusion) {
      files.push({ path, language: languageFor(path), loc: 0, applicable: false, exclusion, role: null, header: { what: null, why: null, raw: [] }, decomposition: null, functions: [], dependencies: [], dependents: [], lineCoverage: null, findings: [] });
      continue;
    }
    const source = readFileSync(absolute, 'utf8');
    const loc = /* WHAT: Count an empty file as zero physical lines. WHY: Non-empty files own their final line even without a trailing newline. */ source.length === 0 ? 0 : source.split('\n').length;
    const parsed = parseSourceFile(path, source);
    const role = roleFor(path);
    const findings: QualityFinding[] = [];
    // WHAT: Require one parseable file-level purpose and rationale.
    // WHY: Every authored source owner must explain what it does and why it exists.
    if (!parsed.header.what || !parsed.header.why) findings.push(finding('file_what_why_missing', path, 1, null, 'File header requires WHAT and WHY comments.'));
    // WHAT: Expose files whose architecture role cannot be derived.
    // WHY: Every applicable code file needs one queryable Code Quality Gate role.
    if (role === 'unclassified') findings.push(finding('quality_role_missing', path, 1, null, 'No quality role matched the file.'));
    // WHAT: Require exact decomposition evidence only beyond the 300 LOC threshold.
    // WHY: Large source owners need current qualitative retention analysis.
    if (loc > 300 && !parsed.decomposition) findings.push(finding('decomposition_analysis_missing', path, 1, null, `File has ${loc} LOC and no DECOMPOSITION_ANALYSIS block.`));
    // WHAT: Reject stale decomposition LOC independently from block presence.
    // WHY: The analysis must be reassessed whenever the file changes.
    if (loc > 300 && parsed.decomposition && parsed.decomposition.loc !== loc) findings.push(finding('decomposition_loc_stale', path, 1, null, `Recorded LOC ${parsed.decomposition.loc} does not equal ${loc}.`));
    for (const callable of parsed.functions) {
      for (const branch of callable.branches) {
        // WHAT: Emit one exact finding for each branch without complete rationale.
        // WHY: Agents must query missing control-flow intent at its source line.
        if (!branch.compliant) findings.push(finding('branch_what_why_missing', path, branch.range.startLine, callable.id, `${branch.kind} branch requires WHAT and WHY comments.`));
      }
    }
    files.push({ path, language: languageFor(path), loc, applicable: true, exclusion: null, role, header: parsed.header, decomposition: parsed.decomposition, functions: parsed.functions, dependencies: [], dependents: [], lineCoverage: null, findings });
  }
  const graph = JSON.parse(readFileSync(input.graphPath, 'utf8')) as unknown;
  applyGraphify(graph, files);
  // WHAT: Join coverage only when the caller supplied one explicit LCOV artifact.
  // WHY: Missing coverage remains unknown instead of becoming false zero coverage.
  if (input.lcovPath) applyLcov(readFileSync(input.lcovPath, 'utf8'), files);
  const findings = files.flatMap((file) => file.findings);
  return { version: 1, repository: resolve(input.repository), commit: input.commit, generatedAt: new Date().toISOString(), graphify: { package: 'graphifyy', version: '0.9.22', license: 'MIT', graphPath: relative(input.repository, input.graphPath).replaceAll('\\', '/') }, files, findings };
}
