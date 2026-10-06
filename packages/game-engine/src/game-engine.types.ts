export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type NumberRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EnemyRank = 'jack' | 'queen' | 'king';
export type NumberCard = Readonly<{
  kind: 'number';
  id: string;
  rank: NumberRank;
  suit: Suit;
}>;
export type RoyalCard = Readonly<{
  kind: 'royal';
  id: string;
  rank: EnemyRank;
  suit: Suit;
}>;
export type Card = NumberCard | RoyalCard;

export type Player = Readonly<{ id: string; hand: readonly Card[] }>;
export type Battle = Readonly<{
  enemy: RoyalCard;
  damageDealt: number;
  playedCards: readonly Card[];
  immunityCancelled: boolean;
}>;
export type World = Readonly<{
  /** Players in clockwise seating order. */
  players: readonly Player[];
  currentPlayer: string;
  battle: Battle;
  tavern: readonly Card[];
  discard: readonly Card[];
  castle: readonly RoyalCard[];
  /** Unsigned 32-bit state for deterministic discard shuffles. */
  rngState: number;
}>;
export type Decision =
  | Readonly<{ kind: 'await-turn-action' }>
  | Readonly<{ kind: 'await-damage-discard'; requiredDamage: number }>;

export type GameState = Readonly<{ world: World; decision: Decision }>;

export type PlayCards = Readonly<{
  kind: 'play-cards';
  playerId: string;
  cardIds: readonly string[];
}>;
export type DiscardForDamage = Readonly<{
  kind: 'discard-for-damage';
  playerId: string;
  cardIds: readonly string[];
}>;
export type Action = PlayCards | DiscardForDamage;
