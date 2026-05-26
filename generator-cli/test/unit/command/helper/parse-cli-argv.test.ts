/**
 * WHAT: Unit coverage for generated function parse-cli-argv.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgv } from '../../../../src/business/command/helper/parse-cli-argv.js';

test('parse-cli-argv exports an implemented function', () => {
  assert.equal(typeof parseCliArgv, 'function');
});

test('parse-cli-argv rejects ledger mutation commands', () => {
  assert.throws(
    () => parseCliArgv(['ledger', 'mutate', '--ledger', '.blueprinttool/specs.json']),
    /Unsupported generator-cli mode: ledger/,
  );
});
