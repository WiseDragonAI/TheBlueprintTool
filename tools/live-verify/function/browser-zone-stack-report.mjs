export function browserZoneStackReport(groupSelector, zoneSelector) {
  const groups = [...document.querySelectorAll(groupSelector)];
  const zones = [...document.querySelectorAll(zoneSelector)];
  for (const group of groups) {
    const groupRect = group.getBoundingClientRect();
    for (const zone of zones) {
      const zoneRect = zone.getBoundingClientRect();
      const left = Math.max(groupRect.left, zoneRect.left);
      const right = Math.min(groupRect.right, zoneRect.right);
      const top = Math.max(groupRect.top, zoneRect.top);
      const bottom = Math.min(groupRect.bottom, zoneRect.bottom);
      if (right <= left || bottom <= top) continue;
      const point = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const stack = document.elementsFromPoint(point.x, point.y);
      const groupIndex = stack.indexOf(group);
      const zoneIndex = stack.indexOf(zone);
      const groupZIndex = Number(getComputedStyle(group).zIndex);
      const zoneZIndex = Number(getComputedStyle(zone).zIndex);
      const pointVisible = point.x >= 0 && point.y >= 0 && point.x <= window.innerWidth && point.y <= window.innerHeight;
      const cssStackOk = zoneZIndex > groupZIndex;
      const pointStackOk = zoneIndex >= 0 && groupIndex >= 0 && zoneIndex < groupIndex;
      return {
        ok: cssStackOk && (!pointVisible || pointStackOk),
        groupId: group.dataset.groupId ?? '',
        zoneId: zone.dataset.zoneId ?? '',
        pointVisible,
        groupZIndex,
        zoneZIndex,
        groupIndex,
        zoneIndex
      };
    }
  }
  return { ok: false, reason: 'missing-overlap' };
}
