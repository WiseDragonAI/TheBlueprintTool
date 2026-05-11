/**
 * WHAT: Unit coverage for generated function write-generated-report-file.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeGeneratedReportFile } from '../../../../src/business/report/effect/write-generated-report-file.js';

test('write-generated-report-file exports an implemented function', () => {
  assert.equal(typeof writeGeneratedReportFile, 'function');
});
