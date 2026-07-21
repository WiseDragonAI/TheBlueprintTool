type GitReviewDisposableElement = HTMLElement & { disposeGitReviewWidget?: () => void };

const gitReviewElementName = 'decision-os-git-review';

export function ensureGitReviewElementDefinition(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
  elementBase: typeof HTMLElement | undefined = globalThis.HTMLElement,
): boolean {
  if (!registry || !elementBase) return false;
  if (registry.get(gitReviewElementName)) return true;
  class DecisionOsGitReviewElement extends elementBase {
    disposeGitReviewWidget?: () => void;

    disconnectedCallback(): void {
      this.disposeGitReviewWidget?.();
      this.disposeGitReviewWidget = undefined;
    }
  }
  registry.define(gitReviewElementName, DecisionOsGitReviewElement);
  return true;
}

export function createGitReviewWidgetRoot(documentRef: Document = document): GitReviewDisposableElement {
  const customElementReady = ensureGitReviewElementDefinition();
  return documentRef.createElement(customElementReady ? gitReviewElementName : 'section') as GitReviewDisposableElement;
}

export function registerGitReviewWidgetDisposal(root: HTMLElement, dispose: () => void): void {
  (root as GitReviewDisposableElement).disposeGitReviewWidget = dispose;
}
