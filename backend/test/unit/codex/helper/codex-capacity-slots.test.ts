/**
 * WHAT: Verifies bounded capacity reservations used by direct and project-sync Codex work.
 * WHY: Capacity exhaustion must cancel or time out without leaking a slot or hanging forever.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexCapacitySlots } from '@backend/business/codex/helper/codex-capacity-slots.js';

test('a saturated slot wait stops when its request is cancelled', async () => {
  const slots = createCodexCapacitySlots({
    capacity: () => 1,
    externalRunningCount: () => 1,
    pollIntervalMs: 5,
  });
  const abort = new AbortController();
  const pending = slots.acquire({ signal: abort.signal, timeoutMs: 1_000 });
  abort.abort();

  await assert.rejects(pending, /codex_slot_wait_cancelled/);
  assert.equal(slots.reservedCount(), 0);
});

test('a saturated slot wait has a finite deadline', async () => {
  const slots = createCodexCapacitySlots({
    capacity: () => 1,
    externalRunningCount: () => 1,
    pollIntervalMs: 5,
  });

  await assert.rejects(slots.acquire({ timeoutMs: 20 }), /codex_slot_wait_timeout:20/);
  assert.equal(slots.reservedCount(), 0);
});

test('a released reservation makes capacity available to another waiter', async () => {
  const slots = createCodexCapacitySlots({
    capacity: () => 1,
    externalRunningCount: () => 0,
    pollIntervalMs: 5,
  });
  const releaseFirst = await slots.acquire();
  let secondAcquired = false;
  const second = slots.acquire({ timeoutMs: 1_000 }).then((release) => {
    secondAcquired = true;
    return release;
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(secondAcquired, false);
  assert.equal(slots.reservedCount(), 1);

  releaseFirst();
  const releaseSecond = await second;
  assert.equal(secondAcquired, true);
  assert.equal(slots.reservedCount(), 1);
  releaseSecond();
  assert.equal(slots.reservedCount(), 0);
});
