/**
 * WHAT: Builds a structural unit coverage report for frontend function files.
 * WHY: Agents need a deterministic report for missing dedicated unit test files.
 */
import { deriveUnitTestPath } from './derive-unit-test-path.mjs';
import { listSourceFunctionFiles } from './list-source-function-files.mjs';
import { listUnitTestFiles } from './list-unit-test-files.mjs';

export function buildUnitCoverageReport(rootDirectory) {
  const sourceFiles = listSourceFunctionFiles(rootDirectory);
  const testFiles = new Set(listUnitTestFiles(rootDirectory));
  const entries = [];
  for (const sourcePath of sourceFiles) {
    const expectedTestPath = deriveUnitTestPath(rootDirectory, sourcePath);
    entries.push({
      sourcePath,
      expectedTestPath,
      covered: testFiles.has(expectedTestPath)
    });
  }
  const missing = entries.filter(function isMissing(entry) {
    return !entry.covered;
  });
  return {
    sourceFunctionFiles: entries.length,
    unitTestedFunctionFiles: entries.length - missing.length,
    missingUnitTestFiles: missing.length,
    coveragePercent: entries.length === 0 ? 100 : ((entries.length - missing.length) / entries.length) * 100,
    missing
  };
}
