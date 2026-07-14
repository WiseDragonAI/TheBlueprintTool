const CONTROL_ROOM_TABS = new Set(['queue', 'active', 'delayed']);

export function parseControlRoomRoute(url) {
  const parsed = new URL(url, 'http://decision-os.local');
  const requestedTab = parsed.searchParams.get('tab');
  let anchor = '';
  try {
    anchor = decodeURIComponent(parsed.hash.slice(1));
  } catch {
    anchor = '';
  }
  return {
    tab: CONTROL_ROOM_TABS.has(requestedTab) ? requestedTab : 'queue',
    anchor: anchor.startsWith('task-') ? anchor : ''
  };
}

export function controlRoomPath(tab, anchor = '') {
  const safeTab = CONTROL_ROOM_TABS.has(tab) ? tab : 'queue';
  const safeAnchor = anchor.startsWith('task-') ? anchor : '';
  return `/?tab=${encodeURIComponent(safeTab)}${safeAnchor ? `#${encodeURIComponent(safeAnchor)}` : ''}`;
}
