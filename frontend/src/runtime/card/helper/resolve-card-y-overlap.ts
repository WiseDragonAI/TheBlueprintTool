export type CardLayoutRecord = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function horizontalOverlap(leftA: number, widthA: number, leftB: number, widthB: number): number {
  return Math.max(0, Math.min(leftA + widthA, leftB + widthB) - Math.max(leftA, leftB));
}

function belongsToLane(card: CardLayoutRecord, lane: CardLayoutRecord[]): boolean {
  const minOverlapRatio = 0.5;
  return lane.some((laneCard) => {
    const overlap = horizontalOverlap(card.left, card.width, laneCard.left, laneCard.width);
    return overlap / Math.min(card.width, laneCard.width) >= minOverlapRatio;
  });
}

export function resolveCardYOverlap(cards: CardLayoutRecord[], gap = 48): CardLayoutRecord[] {
  const lanes: CardLayoutRecord[][] = [];
  const sorted = cards
    .map((card) => ({ ...card }))
    .sort((a, b) => a.left - b.left || a.top - b.top || a.id.localeCompare(b.id));

  for (const card of sorted) {
    const lane = lanes.find((candidate) => belongsToLane(card, candidate));
    if (lane) lane.push(card);
    else lanes.push([card]);
  }

  const arranged: CardLayoutRecord[] = [];
  for (const lane of lanes) {
    lane.sort((a, b) => a.top - b.top || a.left - b.left || a.id.localeCompare(b.id));
    for (let index = 1; index < lane.length; index += 1) {
      const previous = lane[index - 1];
      lane[index].top = previous.top + previous.height + gap;
    }
    arranged.push(...lane);
  }

  return arranged;
}
