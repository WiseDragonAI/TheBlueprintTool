export function createCardResizeHandles(): HTMLElement[] {
  return ['nw', 'ne', 'sw', 'se'].map((position) => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${position}`;
    handle.dataset.spec = '60000006';
    return handle;
  });
}
