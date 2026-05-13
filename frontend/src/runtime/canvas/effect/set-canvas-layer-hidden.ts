/**
 * WHAT: Runtime helper that applies hidden state consistently to HTML and SVG canvas layers.
 * WHY: Ledger tabs must suppress static surface layers without relying on element-specific hidden behavior.
 */
export function setCanvasLayerHidden(node: Element, hidden: boolean): void {
  const element = node as HTMLElement | SVGElement;
  node.toggleAttribute('hidden', hidden);
  element.style.display = hidden ? 'none' : '';
}
