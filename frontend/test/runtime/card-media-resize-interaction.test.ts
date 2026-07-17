import test from 'node:test';
import assert from 'node:assert/strict';

type DragListener = (event: { dx: number; target: HTMLElement }) => void;

test('card media resize interaction normalizes promoted and transformed pointer deltas', async () => {
  let listeners: { start: DragListener; move: DragListener; end: DragListener } | undefined;
  const previousInteract = globalThis.interact;
  globalThis.interact = ((selector: string) => {
    assert.equal(selector, '.ledger-card-media-resize-handle');
    return {
      draggable(options: { inertia: boolean; listeners: typeof listeners }) {
        assert.equal(options.inertia, false);
        listeners = options.listeners;
      }
    };
  }) as typeof globalThis.interact;

  const { ensureLedgerCardMediaResizeInteraction } = await import('../../src/runtime/ledger/helper/bind-ledger-card-media-resize.js');
  ensureLedgerCardMediaResizeInteraction();
  assert.ok(listeners);

  const events: string[] = [];
  const shell = {
    dataset: { mediaPromoted: 'true', mediaPromotionScale: '2', mediaLocalMaxWidth: '600' },
    offsetWidth: 1000,
    parentElement: { clientWidth: 600 },
    style: { width: '' },
    getBoundingClientRect: () => ({ width: 1000 }),
    dispatchEvent: (event: Event) => events.push(event.type)
  } as unknown as HTMLElement;
  const handle = { closest: () => shell } as unknown as HTMLElement;

  listeners.start({ dx: 0, target: handle });
  listeners.move({ dx: -32, target: handle });
  listeners.end({ dx: 0, target: handle });

  assert.equal(shell.style.width, '968px');
  assert.equal(shell.dataset.mediaResizing, undefined);
  assert.deepEqual(events, ['ledger-card-media-resize-commit']);
  globalThis.interact = previousInteract;
});
