import type { Card } from '@regicide/protocol';

export type GamePresentationAnchorKey = `card:${string}` | `player:${string}` | 'discard';

export const gamePresentationAnchor = {
  card: (cardId: string): GamePresentationAnchorKey => `card:${cardId}`,
  player: (playerId: string): GamePresentationAnchorKey => `player:${playerId}`,
  discard: 'discard' as const,
};

export type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PreparedCardsDiscardedForDamage = {
  type: 'cardsDiscardedForDamage';
  eventId: number;
  playerId: string;
  cards: Array<{ card: Card; source: RectSnapshot | null }>;
  fallbackDestination: RectSnapshot | null;
};

export type PreparedGamePresentation = PreparedCardsDiscardedForDamage;

export function snapshotRect(element: HTMLElement | undefined): RectSnapshot | null {
  if (!element) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

export function isVisibleRect(rect: RectSnapshot | null): rect is RectSnapshot {
  return (
    rect !== null &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left + rect.width > 0 &&
    rect.top + rect.height > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}
