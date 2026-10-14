import type { Card, RoyalCard } from '@regicide/protocol';

export type GamePresentationAnchorKey =
  | `card:${string}`
  | `player:${string}`
  | `battle-card:${string}`
  | 'battle-target'
  | 'enemy'
  | 'discard'
  | 'tavern';

export const gamePresentationAnchor = {
  card: (cardId: string): GamePresentationAnchorKey => `card:${cardId}`,
  player: (playerId: string): GamePresentationAnchorKey => `player:${playerId}`,
  battleCard: (cardId: string): GamePresentationAnchorKey => `battle-card:${cardId}`,
  battleTarget: 'battle-target' as const,
  enemy: 'enemy' as const,
  discard: 'discard' as const,
  tavern: 'tavern' as const,
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

export type PreparedHeartsRecovery = {
  type: 'heartsRecovery';
  eventId: number;
  recoveredCount: number;
  fallbackDiscard: RectSnapshot | null;
  fallbackTavern: RectSnapshot | null;
};

export type PreparedCardsPlayed = {
  type: 'cardsPlayed';
  eventId: number;
  playerId: string;
  cards: Array<{ card: Card; source: RectSnapshot | null }>;
  fallbackBattleTarget: RectSnapshot | null;
};

export type PreparedEnemyDefeatSequence = {
  type: 'enemyDefeatSequence';
  eventId: number;
  defeatEventId: number;
  playerId: string;
  playedCards: PreparedCardsPlayed['cards'];
  battleCards: Array<{ card: Card; source: RectSnapshot | null; newlyPlayed: boolean }>;
  enemy: {
    card: RoyalCard;
    source: RectSnapshot | null;
    destination: 'discard' | 'tavern';
  };
  fallbackBattleTarget: RectSnapshot | null;
  fallbackDiscard: RectSnapshot | null;
  fallbackTavern: RectSnapshot | null;
  heartsRecovery: PreparedHeartsRecovery | null;
};

export type PreparedGamePresentation =
  | PreparedCardsDiscardedForDamage
  | PreparedCardsPlayed
  | PreparedHeartsRecovery
  | PreparedEnemyDefeatSequence;

export function snapshotRect(element: HTMLElement | undefined): RectSnapshot | null {
  if (!element) {
    return null;
  }
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
