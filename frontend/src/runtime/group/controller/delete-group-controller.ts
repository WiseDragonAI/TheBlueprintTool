import { telemetry } from '../../telemetry/effect/telemetry.js';
import { deleteSelectedGroups } from '../effect/delete-selected-groups.js';

export async function deleteGroupController(input: { groupId?: string } = {}): Promise<void> {
  const groupIds = input.groupId ? [input.groupId] : undefined;
  telemetry('delete-group-controller', { groupIds });
  await deleteSelectedGroups({ groupIds });
}
