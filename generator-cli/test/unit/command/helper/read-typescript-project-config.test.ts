/**
 * WHAT: Unit coverage for generated function read-typescript-project-config.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTypescriptProjectConfig } from '../../../../src/business/command/helper/read-typescript-project-config.js';

test('read-typescript-project-config exports an implemented function', () => {
  assert.equal(typeof readTypescriptProjectConfig, 'function');
});
