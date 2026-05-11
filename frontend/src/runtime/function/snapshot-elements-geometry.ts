export function snapshotElementsGeometry(selector: string, key: string): Record<string, Record<string, number>> {
  return Object.fromEntries(
    Array.from(document.querySelectorAll(selector)).map((node) => {
      const element = node as HTMLElement;
      return [element.dataset[key] ?? '', {
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight
      }];
    }).filter(([id]) => Boolean(id))
  );
}
