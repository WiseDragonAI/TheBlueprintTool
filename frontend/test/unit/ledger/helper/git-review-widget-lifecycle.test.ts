import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureGitReviewElementDefinition,
  registerGitReviewWidgetDisposal,
} from '../../../../src/runtime/ledger/helper/git-review-widget-lifecycle.js';

test('disconnecting a Git review element disposes its capture exactly once', () => {
  class FakeElement {}
  const definitions = new Map<string, CustomElementConstructor>();
  const registry = {
    define(name: string, constructor: CustomElementConstructor) { definitions.set(name, constructor); },
    get(name: string) { return definitions.get(name); },
  } as Pick<CustomElementRegistry, 'define' | 'get'> as CustomElementRegistry;

  assert.equal(ensureGitReviewElementDefinition(registry, FakeElement as unknown as typeof HTMLElement), true);
  const ElementConstructor = definitions.get('decision-os-git-review') as CustomElementConstructor;
  const element = new ElementConstructor() as HTMLElement & { disconnectedCallback(): void };
  let disposalCount = 0;
  registerGitReviewWidgetDisposal(element, () => { disposalCount += 1; });

  element.disconnectedCallback();
  element.disconnectedCallback();
  assert.equal(disposalCount, 1);
});
