export function calculateRelationshipStandoff({ sourcePort, targetPort, horizontal, gap = 18 }: { sourcePort: { x: number; y: number }; targetPort: { x: number; y: number }; horizontal: boolean; gap?: number }): { sourceStandoff: { x: number; y: number }; targetStandoff: { x: number; y: number }; direction: number } {
  const direction = horizontal
    ? (targetPort.x >= sourcePort.x ? 1 : -1)
    : (targetPort.y >= sourcePort.y ? 1 : -1);
  const sourceStandoff = horizontal
    ? { x: sourcePort.x + direction * gap, y: sourcePort.y }
    : { x: sourcePort.x, y: sourcePort.y + direction * gap };
  const targetStandoff = horizontal
    ? { x: targetPort.x - direction * gap, y: targetPort.y }
    : { x: targetPort.x, y: targetPort.y - direction * gap };
  return { sourceStandoff, targetStandoff, direction };
}
