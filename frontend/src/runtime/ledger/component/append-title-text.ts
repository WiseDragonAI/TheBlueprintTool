export function appendTitleText(parent: HTMLElement, text: string): void {
  const segments = text.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g).filter(Boolean);
  for (const [index, segment] of segments.entries()) {
    if (index > 0) parent.appendChild(document.createElement('wbr'));
    parent.appendChild(document.createTextNode(segment));
  }
}
