type RegionEdit = { label?: string; color?: string };

export function snapshotCanvasRegionEdits(): { zones: Record<string, RegionEdit>; groups: Record<string, RegionEdit> } {
  return {
    zones: snapshotRegionEdits('[data-zone-id]', 'zoneId', true),
    groups: snapshotRegionEdits('[data-group-id]', 'groupId', false)
  };
}

function snapshotRegionEdits(selector: string, key: string, includeColor: boolean): Record<string, RegionEdit> {
  return Object.fromEntries(Array.from(document.querySelectorAll(selector)).map((node) => {
    const element = node as HTMLElement;
    const id = element.dataset[key] ?? '';
    const label = element.querySelector('.zone-title')?.textContent?.trim() ?? '';
    const color = includeColor ? element.style.getPropertyValue('--zone-color').trim() : '';
    return [id, { label, ...(color ? { color } : {}) }];
  }).filter(([id]) => Boolean(id)));
}
