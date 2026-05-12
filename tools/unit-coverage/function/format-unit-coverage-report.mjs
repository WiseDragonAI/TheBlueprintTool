/**
 * WHAT: Formats the frontend structural unit coverage report as prose-friendly lines.
 * WHY: Coverage output should be readable in terminal logs and final agent summaries.
 */
import { relative } from 'node:path';

export function formatUnitCoverageReport(rootDirectory, report) {
  const lines = [
    `sourceFunctionFiles=${report.sourceFunctionFiles}`,
    `unitTestedFunctionFiles=${report.unitTestedFunctionFiles}`,
    `missingUnitTestFiles=${report.missingUnitTestFiles}`,
    `coveragePercent=${report.coveragePercent.toFixed(2)}`
  ];
  for (const missing of report.missing) {
    lines.push(`missing=${relative(rootDirectory, missing.sourcePath)} -> ${relative(rootDirectory, missing.expectedTestPath)}`);
  }
  return lines.join('\n');
}
