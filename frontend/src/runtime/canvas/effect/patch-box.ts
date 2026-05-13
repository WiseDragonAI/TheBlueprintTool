export function patchBox(node: HTMLElement, x: number, y: number, width: number, height: number): void {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
}
