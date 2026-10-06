import type {
  AnimalCard,
  Card,
  EnemyRank,
  GameState,
  JesterCard,
  NumberCard,
  NumberRank,
  RoyalCard,
  Suit,
} from './game-engine.types.ts';
import { playerCountRules } from './player-count-rules.ts';
import { shuffle } from './shuffle.ts';

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const satisfies readonly Suit[];
const NUMBER_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const satisfies readonly NumberRank[];
type SetupConfig = Readonly<{
  playerIds: readonly string[];
  rngState: number;
}>;

export function setupGame({ playerIds, rngState }: SetupConfig): GameState {
  const rules = playerCountRules(playerIds.length);
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('Player IDs must be distinct');
  }

  const jacks = shuffle(royalsOfRank('jack'), rngState);
  const queens = shuffle(royalsOfRank('queen'), jacks.rngState);
  const kings = shuffle(royalsOfRank('king'), queens.rngState);
  const tavernCards: Card[] = [
    ...NUMBER_RANKS.flatMap((rank) =>
      SUITS.map(
        (suit): NumberCard => ({
          kind: 'number',
          id: `number-${rank}-${suit}`,
          rank,
          suit,
        }),
      ),
    ),
    ...SUITS.map((suit): AnimalCard => ({ kind: 'animal', id: `animal-${suit}`, suit })),
    ...Array.from(
      { length: rules.jesterCount },
      (_, index): JesterCard => ({
        kind: 'jester',
        id: `jester-${index + 1}`,
      }),
    ),
  ];
  const tavern = shuffle(tavernCards, kings.rngState);

  const players: { id: string; hand: Card[] }[] = playerIds.map((id) => ({ id, hand: [] }));
  let dealt = 0;
  for (let round = 0; round < rules.handLimit; round++) {
    for (const player of players) {
      const card = tavern.cards[dealt];
      if (!card) throw new Error('The Tavern has no card to deal');
      player.hand.push(card);
      dealt++;
    }
  }

  const [enemy, ...remainingJacks] = jacks.cards;
  const castle: RoyalCard[] = [...remainingJacks, ...queens.cards, ...kings.cards];
  return {
    kind: 'active',
    world: {
      players,
      currentPlayer: playerIds[0]!,
      consecutiveYields: 0,
      soloJestersUsed: playerIds.length === 1 ? 0 : null,
      battle: { enemy: enemy!, damageDealt: 0, plays: [], immunityCancelled: false },
      tavern: tavern.cards.slice(dealt),
      discard: [],
      castle,
      rngState: tavern.rngState,
    },
    decision: { kind: 'await-turn-action' },
  };
}

function royalsOfRank(rank: EnemyRank): RoyalCard[] {
  return SUITS.map((suit) => ({ kind: 'royal', id: `${rank}-${suit}`, rank, suit }));
}
