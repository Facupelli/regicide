export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type NumberRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EnemyRank = 'jack' | 'queen' | 'king';
export type NumberCard = Readonly<{
  kind: 'number';
  id: string;
  rank: NumberRank;
  suit: Suit;
}>;
export type AnimalCard = Readonly<{
  kind: 'animal';
  id: string;
  suit: Suit;
}>;
export type RoyalCard = Readonly<{
  kind: 'royal';
  id: string;
  rank: EnemyRank;
  suit: Suit;
}>;
export type JesterCard = Readonly<{
  kind: 'jester';
  id: string;
}>;
export type Card = NumberCard | AnimalCard | RoyalCard | JesterCard;

export type AttackCard = NumberCard | AnimalCard | RoyalCard;
type NumberCardOfRank<R extends NumberRank> = NumberCard & Readonly<{ rank: R }>;
export type NumberCombo =
  | readonly [NumberCardOfRank<2>, NumberCardOfRank<2>]
  | readonly [NumberCardOfRank<3>, NumberCardOfRank<3>]
  | readonly [NumberCardOfRank<4>, NumberCardOfRank<4>]
  | readonly [NumberCardOfRank<5>, NumberCardOfRank<5>]
  | readonly [NumberCardOfRank<2>, NumberCardOfRank<2>, NumberCardOfRank<2>]
  | readonly [NumberCardOfRank<3>, NumberCardOfRank<3>, NumberCardOfRank<3>]
  | readonly [NumberCardOfRank<2>, NumberCardOfRank<2>, NumberCardOfRank<2>, NumberCardOfRank<2>];
export type AttackPlay = Readonly<{
  kind: 'attack';
  cards:
    | readonly [AttackCard]
    | readonly [AnimalCard, AttackCard]
    | readonly [AttackCard, AnimalCard]
    | NumberCombo;
}>;
export type JesterPlay = Readonly<{ kind: 'jester'; card: JesterCard }>;
export type HistoricalPlay = AttackPlay | JesterPlay;

export type Player = Readonly<{ id: string; hand: readonly Card[] }>;
export type Battle = Readonly<{
  enemy: RoyalCard;
  damageDealt: number;
  plays: readonly HistoricalPlay[];
  immunityCancelled: boolean;
}>;
export type World = Readonly<{
  /** Players in clockwise seating order. */
  players: readonly Player[];
  currentPlayer: string;
  /** Number of successive turns on which a player yielded. */
  consecutiveYields: number;
  battle: Battle;
  tavern: readonly Card[];
  discard: readonly Card[];
  castle: readonly RoyalCard[];
  /** Unsigned 32-bit state for deterministic discard shuffles. */
  rngState: number;
}>;
export type ResolvedWorld = Omit<World, 'battle'>;

export type Decision =
  | Readonly<{ kind: 'await-turn-action' }>
  | Readonly<{ kind: 'await-damage-discard'; requiredDamage: number }>
  | Readonly<{ kind: 'await-next-player-choice' }>;

export type GameState =
  | Readonly<{ kind: 'active'; world: World; decision: Decision; result?: never }>
  | Readonly<{ kind: 'game-over'; world: World; result: 'loss'; decision?: never }>
  | Readonly<{ kind: 'game-over'; world: ResolvedWorld; result: 'win'; decision?: never }>;

export type PlayCards = Readonly<{
  kind: 'play-cards';
  playerId: string;
  cardIds: readonly string[];
}>;
export type YieldTurn = Readonly<{ kind: 'yield'; playerId: string }>;
export type DiscardForDamage = Readonly<{
  kind: 'discard-for-damage';
  playerId: string;
  cardIds: readonly string[];
}>;
export type ChooseNextPlayer = Readonly<{
  kind: 'choose-next-player';
  playerId: string;
  targetPlayerId: string;
}>;
export type Action = PlayCards | YieldTurn | DiscardForDamage | ChooseNextPlayer;
