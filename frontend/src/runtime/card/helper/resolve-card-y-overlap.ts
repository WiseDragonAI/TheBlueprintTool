export type CardLayoutRecord = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function resolveCardYOverlap(cards: CardLayoutRecord[], gap = 48): CardLayoutRecord[] {
  const arranged = cards
    .map((card) => ({ ...card }))
    .sort((a, b) => a.left - b.left || a.top - b.top || a.id.localeCompare(b.id));

  for (let index = 1; index < arranged.length; index += 1) {
    const previous = arranged[index - 1];
    arranged[index].top = previous.top + previous.height + gap;
  }

  return arranged;
}
