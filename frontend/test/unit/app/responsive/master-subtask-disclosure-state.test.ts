/**
 * WHAT: Verifies every responsive master-subtask disclosure identity transition.
 * WHY: Initial collapse, same-card retention, changed-card reset, expansion, and collapse must share one sentinel contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileMasterSubtaskDisclosureIdentity,
  toggleMasterSubtaskDisclosureIdentity,
} from '../../../../src/app/responsive/master-subtask-disclosure-state.js';

test('reconciliation starts a newly rendered master task collapsed', () => {
  assert.equal(reconcileMasterSubtaskDisclosureIdentity('', 'master-one'), '');
});

test('reconciliation retains expansion when rendering the same master task again', () => {
  assert.equal(reconcileMasterSubtaskDisclosureIdentity('master-one', 'master-one'), 'master-one');
});

test('reconciliation resets expansion when rendering a different master task', () => {
  assert.equal(reconcileMasterSubtaskDisclosureIdentity('master-one', 'master-two'), '');
});

test('toggling an unexpanded master task expands its identity', () => {
  assert.equal(toggleMasterSubtaskDisclosureIdentity('', 'master-one'), 'master-one');
});

test('toggling a different master task selects its identity', () => {
  assert.equal(toggleMasterSubtaskDisclosureIdentity('master-one', 'master-two'), 'master-two');
});

test('toggling the expanded master task collapses it to the empty sentinel', () => {
  assert.equal(toggleMasterSubtaskDisclosureIdentity('master-one', 'master-one'), '');
});
