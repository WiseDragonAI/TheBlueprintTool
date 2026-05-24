import { content } from '../../dom.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { createLedgerGroupAnnotation } from '../../ledger/helper/create-ledger-group-annotation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function createGroupFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const groupId = createLedgerObjectId('group');
  if (state.activeLedger) {
    const committed = await commitActiveLedgerMutation({ action: 'create-group', annotation: createLedgerGroupAnnotation({ id: groupId, rect }) });
    if (committed) {
      state.selection = { cardIds: [], zoneIds: [], groupIds: [groupId] };
      telemetry('render-group-layer', { created: groupId, authority: 'server' });
    }
    return;
  }
  const group = document.createElement('article');
  group.className = 'zone group-zone selected';
  group.dataset.groupId = groupId;
  group.dataset.threadId = `thread-${groupId}`;
  group.dataset.spec = '1d444573 796827d0 4801e6c7 85c81d67 0421d906 dff19657 d9d57c2c 2476bfa1 d2fbfa28 612afeda 8a05ef46 5b918cd3 d4f90f42 abad6dcb f18da923 c271a0df';
  group.style.left = `${Math.max(0, rect.x)}px`;
  group.style.top = `${Math.max(0, rect.y)}px`;
  group.style.width = `${Math.max(220, rect.width)}px`;
  group.style.height = `${Math.max(160, rect.height)}px`;
  group.innerHTML = '<div class="resize-handle nw"></div><div class="resize-handle ne"></div><div class="resize-handle sw"></div><div class="resize-handle se"></div><div class="zone-title">New group</div><div class="zone-actions"><button class="icon-button" type="button" data-action="edit-zone" data-spec="3fd7a96a" title="Edit group name" aria-label="Edit group name">✎</button></div>';
  content.insertBefore(group, content.querySelector('.marquee'));
  state.selection = { cardIds: [], zoneIds: [], groupIds: [groupId] };
  telemetry('commit-static-surface-edit', { createGroup: groupId, geometry: rect });
  telemetry('render-group-layer', { created: groupId });
}
