/**
 * WHAT: Defines staged detail reveal queue record types.
 * WHY: The scheduler shares queue records across one-function implementation files.
 */
export type RevealCard = {
  element: HTMLElement;
  visible: boolean;
  distance: number;
};

export type OrderedRevealCards = {
  urgent: RevealCard[];
  background: RevealCard[];
  visibleCount: number;
};
