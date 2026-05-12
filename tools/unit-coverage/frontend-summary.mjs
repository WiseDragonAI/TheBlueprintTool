#!/usr/bin/env node
/**
 * WHAT: CLI entrypoint for frontend structural unit coverage.
 * WHY: Repeated coverage checks must be a reusable tool, not ad hoc shell scripts.
 */
import { cwd } from 'node:process';
import { buildUnitCoverageReport } from './function/build-unit-coverage-report.mjs';
import { formatUnitCoverageReport } from './function/format-unit-coverage-report.mjs';

const rootDirectory = cwd();
const report = buildUnitCoverageReport(rootDirectory);
console.log(formatUnitCoverageReport(rootDirectory, report));
if (report.missingUnitTestFiles > 0) process.exitCode = 1;
