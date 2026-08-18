/**
 * WHAT: Joins LCOV line and function execution records to quality-map files and AST callables.
 * WHY: Structural ownership and control-flow rationale must remain visible beside actual test execution coverage.
 */
import type { QualityFile } from '../types.js';

export function applyLcov(lcov: string, files: QualityFile[]): void {
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  let current: QualityFile | null = null;
  let coveredLines = 0;
  let instrumentedLines = 0;
  const functionHits = new Map<string, number>();
  const settle = (): void => {
    // WHAT: Leave files without instrumentation explicitly unknown.
    // WHY: Missing coverage data must not be misreported as zero execution.
    if (!current) return;
    current.lineCoverage = /* WHAT: Preserve unknown coverage without instrumented lines. WHY: Zero executed lines and absent instrumentation are different states. */ instrumentedLines === 0 ? null : (coveredLines / instrumentedLines) * 100;
    for (const callable of current.functions) {
      const hit = functionHits.get(`${callable.range.startLine}:${callable.name}`) ?? functionHits.get(`${callable.range.startLine}:`);
      const executed = /* WHAT: Distinguish an executed callable from an instrumented miss. WHY: Function coverage is binary in normalized LCOV evidence. */ Number(hit ?? 0) > 0 ? 100 : 0;
      callable.coverage = /* WHAT: Preserve unknown callable coverage without an LCOV identity. WHY: Uninstrumented functions must not appear uncovered. */ hit === undefined ? null : executed;
    }
  };
  for (const line of lcov.split('\n')) {
    // WHAT: Start a new exact repository-relative coverage scope.
    // WHY: LCOV records following SF belong only to that source file.
    if (line.startsWith('SF:')) {
      settle();
      const path = line.slice(3).replaceAll('\\', '/').replace(/^.*?\/(backend|frontend|trace-evidence|generator-cli|ledger-cli|federation-relay|memory-service|shared|bin|tools)\//, '$1/');
      current = fileByPath.get(path) ?? null;
      coveredLines = 0;
      instrumentedLines = 0;
      functionHits.clear();
      continue;
    }
    // WHAT: Count instrumented and executed lines for the active source file.
    // WHY: Per-file percentages must derive from exact LCOV execution counts.
    if (current && line.startsWith('DA:')) {
      const hits = Number(line.slice(3).split(',')[1] ?? 0);
      instrumentedLines += 1;
      coveredLines += /* WHAT: Count each executed instrumented line once. WHY: Hit frequency does not change line coverage percentage. */ hits > 0 ? 1 : 0;
      continue;
    }
    // WHAT: Retain function hit counts under their LCOV identity.
    // WHY: AST callable coverage needs function-level evidence beyond line percentages.
    if (current && line.startsWith('FNDA:')) {
      const [hits, name = ''] = line.slice(5).split(',', 2);
      const declared = [...functionHits.keys()].find((key) => key.endsWith(`:${name}`));
      functionHits.set(declared ?? `0:${name}`, Number(hits));
      continue;
    }
    // WHAT: Retain function declaration lines before their hit record arrives.
    // WHY: Source ranges disambiguate same-named callables.
    if (current && line.startsWith('FN:')) {
      const [lineNumber, name = ''] = line.slice(3).split(',', 2);
      functionHits.set(`${lineNumber}:${name}`, 0);
      continue;
    }
    // WHAT: Finalize the active source at the LCOV record boundary.
    // WHY: Coverage counters cannot leak into the next file.
    if (line === 'end_of_record') {
      settle();
      current = null;
      coveredLines = 0;
      instrumentedLines = 0;
      functionHits.clear();
    }
  }
  settle();
}
