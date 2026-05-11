export function elementCanvasRect(element: HTMLElement): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  return {
    left: element.offsetLeft,
    top: element.offsetTop,
    right: element.offsetLeft + element.offsetWidth,
    bottom: element.offsetTop + element.offsetHeight,
    width: element.offsetWidth,
    height: element.offsetHeight
  };
}
