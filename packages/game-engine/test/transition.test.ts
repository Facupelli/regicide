import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transition, type Action, type Card, type GameState } from '../src/index.ts';

const fiveClubs: Card = { kind: 'number', id: 'five-clubs', rank: 5, suit: 'clubs' };
const sixDiamonds: Card = { kind: 'number', id: 'six-diamonds', rank: 6, suit: 'diamonds' };
const fourSpades: Card = { kind: 'number', id: 'four-spades', rank: 4, suit: 'spades' };
const twoHearts: Card = { kind: 'number', id: 'two-hearts', rank: 2, suit: 'hearts' };
const threeDiamonds: Card = { kind: 'number', id: 'three-diamonds', rank: 3, suit: 'diamonds' };
const jackHearts = {
  kind: 'royal',
  id: 'jack-hearts',
  rank: 'jack',
  suit: 'hearts',
} as const satisfies Card;

function initialState(): GameState {
  return {
    world: {
      players: [
        { id: 'alice', hand: [fiveClubs, sixDiamonds, fourSpades, twoHearts] },
        { id: 'bob', hand: [threeDiamonds] },
      ],
      currentPlayer: 'alice',
      battle: {
        enemy: jackHearts,
        damageDealt: 0,
        playedCards: [],
        immunityCancelled: false,
      },
      tavern: [],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
}

function handOf(state: GameState, playerId: string): readonly Card[] {
  const player = state.world.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player.hand;
}

function allCardIds(state: GameState): string[] {
  const { players, battle, tavern, discard, castle } = state.world;
  return [
    ...players.flatMap((player) => player.hand),
    battle.enemy,
    ...battle.playedCards,
    ...tavern,
    ...discard,
    ...castle,
  ].map((card) => card.id);
}

function assertCardsInExactlyOneZone(state: GameState, originalIds: string[]): void {
  const ids = allCardIds(state);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.toSorted(), originalIds.toSorted());
}

function assertRejectedWithoutMutation(state: GameState, action: Action): void {
  const before = structuredClone(state);
  assert.throws(() => transition(state, action));
  assert.deepEqual(state, before);
}

void test('a Clubs attack resolves through retaliation, then discarding passes the turn to Bob', () => {
  const initial = initialState();
  const initialSnapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fiveClubs.id],
  });

  assert.deepEqual(initial, initialSnapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [sixDiamonds, fourSpades, twoHearts]);
  assert.deepEqual(afterPlay.world.battle.playedCards, [fiveClubs]);
  assert.deepEqual(afterPlay.world.battle.enemy, jackHearts);
  assert.equal(afterPlay.world.battle.damageDealt, 10);
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, {
    kind: 'await-damage-discard',
    requiredDamage: 10,
  });
  assertCardsInExactlyOneZone(afterPlay, originalIds);

  const afterPlaySnapshot = structuredClone(afterPlay);
  const afterDiscard = transition(afterPlay, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [sixDiamonds.id, fourSpades.id],
  });

  assert.deepEqual(afterPlay, afterPlaySnapshot);
  assert.deepEqual(handOf(afterDiscard, 'alice'), [twoHearts]);
  assert.deepEqual(handOf(afterDiscard, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterDiscard.world.discard, [sixDiamonds, fourSpades]);
  assert.deepEqual(afterDiscard.world.battle.playedCards, [fiveClubs]);
  assert.deepEqual(afterDiscard.world.battle.enemy, jackHearts);
  assert.equal(afterDiscard.world.battle.damageDealt, 10);
  assert.equal(afterDiscard.world.currentPlayer, 'bob');
  assert.deepEqual(afterDiscard.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterDiscard, originalIds);
});

void test('Spades shield persists across turns and accumulates against the Jack of Hearts', () => {
  const twoSpades = {
    kind: 'number',
    id: 'two-spades',
    rank: 2,
    suit: 'spades',
  } as const satisfies Card;
  const fourHearts = {
    kind: 'number',
    id: 'four-hearts',
    rank: 4,
    suit: 'hearts',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [
        { id: 'alice', hand: [fourSpades, sixDiamonds] },
        { id: 'bob', hand: [twoSpades, fourHearts] },
      ],
      currentPlayer: 'alice',
      battle: {
        enemy: jackHearts,
        damageDealt: 0,
        playedCards: [],
        immunityCancelled: false,
      },
      tavern: [],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
  const originalIds = allCardIds(initial);
  const initialSnapshot = structuredClone(initial);

  const afterAlicePlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fourSpades.id],
  });
  assert.deepEqual(initial, initialSnapshot);
  assert.deepEqual(handOf(afterAlicePlay, 'alice'), [sixDiamonds]);
  assert.deepEqual(afterAlicePlay.world.battle.playedCards, [fourSpades]);
  assert.equal(afterAlicePlay.world.battle.damageDealt, 4);
  assert.equal(afterAlicePlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterAlicePlay.decision, { kind: 'await-damage-discard', requiredDamage: 6 });
  assertCardsInExactlyOneZone(afterAlicePlay, originalIds);

  const afterAlicePlaySnapshot = structuredClone(afterAlicePlay);
  const afterAliceDiscard = transition(afterAlicePlay, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [sixDiamonds.id],
  });
  assert.deepEqual(afterAlicePlay, afterAlicePlaySnapshot);
  assert.deepEqual(handOf(afterAliceDiscard, 'alice'), []);
  assert.deepEqual(afterAliceDiscard.world.discard, [sixDiamonds]);
  assert.deepEqual(afterAliceDiscard.world.battle.playedCards, [fourSpades]);
  assert.equal(afterAliceDiscard.world.battle.damageDealt, 4);
  assert.equal(afterAliceDiscard.world.currentPlayer, 'bob');
  assert.deepEqual(afterAliceDiscard.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterAliceDiscard, originalIds);

  const afterAliceDiscardSnapshot = structuredClone(afterAliceDiscard);
  const afterBobPlay = transition(afterAliceDiscard, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [twoSpades.id],
  });
  assert.deepEqual(afterAliceDiscard, afterAliceDiscardSnapshot);
  assert.deepEqual(handOf(afterBobPlay, 'bob'), [fourHearts]);
  assert.deepEqual(afterBobPlay.world.battle.playedCards, [fourSpades, twoSpades]);
  assert.equal(afterBobPlay.world.battle.damageDealt, 6);
  assert.deepEqual(afterBobPlay.world.discard, [sixDiamonds]);
  assert.equal(afterBobPlay.world.currentPlayer, 'bob');
  assert.deepEqual(afterBobPlay.decision, { kind: 'await-damage-discard', requiredDamage: 4 });
  assertCardsInExactlyOneZone(afterBobPlay, originalIds);
});

void test('Spades that fully shield retaliation advance the turn without a discard decision', () => {
  const eightSpades = {
    kind: 'number',
    id: 'eight-spades',
    rank: 8,
    suit: 'spades',
  } as const satisfies Card;
  const twoSpades = {
    kind: 'number',
    id: 'two-spades',
    rank: 2,
    suit: 'spades',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [
        { id: 'alice', hand: [twoSpades] },
        { id: 'bob', hand: [threeDiamonds] },
      ],
      currentPlayer: 'alice',
      battle: {
        enemy: jackHearts,
        damageDealt: 8,
        playedCards: [eightSpades],
        immunityCancelled: false,
      },
      tavern: [],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
  const originalIds = allCardIds(initial);
  const initialSnapshot = structuredClone(initial);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoSpades.id],
  });

  assert.deepEqual(initial, initialSnapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), []);
  assert.deepEqual(afterPlay.world.battle.playedCards, [eightSpades, twoSpades]);
  assert.equal(afterPlay.world.battle.damageDealt, 10);
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.currentPlayer, 'bob');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('overkill defeats the enemy and gives the defeating player another turn', () => {
  const eightClubs = {
    kind: 'number',
    id: 'eight-clubs',
    rank: 8,
    suit: 'clubs',
  } as const satisfies Card;
  const threeClubs = {
    kind: 'number',
    id: 'three-clubs',
    rank: 3,
    suit: 'clubs',
  } as const satisfies Card;
  const jackDiamonds = {
    kind: 'royal',
    id: 'jack-diamonds',
    rank: 'jack',
    suit: 'diamonds',
  } as const satisfies Card;
  const queenSpades = {
    kind: 'royal',
    id: 'queen-spades',
    rank: 'queen',
    suit: 'spades',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [
        { id: 'alice', hand: [threeClubs, sixDiamonds] },
        { id: 'bob', hand: [threeDiamonds] },
      ],
      currentPlayer: 'alice',
      battle: {
        enemy: jackHearts,
        damageDealt: 16,
        playedCards: [eightClubs],
        immunityCancelled: false,
      },
      tavern: [],
      discard: [],
      castle: [jackDiamonds, queenSpades],
    },
    decision: { kind: 'await-turn-action' },
  };
  const initialSnapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);
  assertCardsInExactlyOneZone(initial, originalIds);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeClubs.id],
  });

  assert.deepEqual(initial, initialSnapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [sixDiamonds]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterPlay.world.discard, [jackHearts, eightClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.tavern, []);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: jackDiamonds,
    damageDealt: 0,
    playedCards: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('exact damage puts the enemy on top of Tavern and gives the defeating player another turn', () => {
  const sevenClubs = {
    kind: 'number',
    id: 'seven-clubs',
    rank: 7,
    suit: 'clubs',
  } as const satisfies Card;
  const threeClubs = {
    kind: 'number',
    id: 'three-clubs',
    rank: 3,
    suit: 'clubs',
  } as const satisfies Card;
  const jackDiamonds = {
    kind: 'royal',
    id: 'jack-diamonds',
    rank: 'jack',
    suit: 'diamonds',
  } as const satisfies Card;
  const queenSpades = {
    kind: 'royal',
    id: 'queen-spades',
    rank: 'queen',
    suit: 'spades',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [
        { id: 'alice', hand: [threeClubs, fiveClubs] },
        { id: 'bob', hand: [threeDiamonds] },
      ],
      currentPlayer: 'alice',
      battle: {
        enemy: jackHearts,
        damageDealt: 14,
        playedCards: [sevenClubs],
        immunityCancelled: false,
      },
      tavern: [twoHearts, sixDiamonds],
      discard: [],
      castle: [jackDiamonds, queenSpades],
    },
    decision: { kind: 'await-turn-action' },
  };
  const initialSnapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);
  assertCardsInExactlyOneZone(initial, originalIds);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeClubs.id],
  });

  assert.deepEqual(initial, initialSnapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [fiveClubs]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterPlay.world.tavern, [jackHearts, twoHearts, sixDiamonds]);
  assert.deepEqual(afterPlay.world.discard, [sevenClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: jackDiamonds,
    damageDealt: 0,
    playedCards: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Diamonds draw attack value clockwise before damage and retaliation, skipping full players', () => {
  const cards = {
    fourDiamonds: { kind: 'number', id: 'four-diamonds', rank: 4, suit: 'diamonds' },
    twoClubs: { kind: 'number', id: 'two-clubs', rank: 2, suit: 'clubs' },
    twoDiamonds: { kind: 'number', id: 'two-diamonds', rank: 2, suit: 'diamonds' },
    threeClubs: { kind: 'number', id: 'three-clubs', rank: 3, suit: 'clubs' },
    fourClubs: { kind: 'number', id: 'four-clubs', rank: 4, suit: 'clubs' },
    fourHearts: { kind: 'number', id: 'four-hearts', rank: 4, suit: 'hearts' },
    fourSpades: { kind: 'number', id: 'four-spades', rank: 4, suit: 'spades' },
    fiveDiamonds: { kind: 'number', id: 'five-diamonds', rank: 5, suit: 'diamonds' },
    fiveSpades: { kind: 'number', id: 'five-spades', rank: 5, suit: 'spades' },
    sixClubs: { kind: 'number', id: 'six-clubs', rank: 6, suit: 'clubs' },
    sixSpades: { kind: 'number', id: 'six-spades', rank: 6, suit: 'spades' },
    sevenClubs: { kind: 'number', id: 'seven-clubs', rank: 7, suit: 'clubs' },
    sevenHearts: { kind: 'number', id: 'seven-hearts', rank: 7, suit: 'hearts' },
    sevenDiamonds: { kind: 'number', id: 'seven-diamonds', rank: 7, suit: 'diamonds' },
    eightClubs: { kind: 'number', id: 'eight-clubs', rank: 8, suit: 'clubs' },
    eightDiamonds: { kind: 'number', id: 'eight-diamonds', rank: 8, suit: 'diamonds' },
    eightHearts: { kind: 'number', id: 'eight-hearts', rank: 8, suit: 'hearts' },
  } as const satisfies Record<string, Card>;
  const initial: GameState = {
    world: {
      players: [
        {
          id: 'alice',
          hand: [
            cards.fourDiamonds,
            cards.twoClubs,
            cards.twoDiamonds,
            cards.threeClubs,
            twoHearts,
          ],
        },
        {
          id: 'bob',
          hand: [
            cards.fourClubs,
            cards.fourHearts,
            cards.fourSpades,
            fiveClubs,
            cards.fiveDiamonds,
            cards.fiveSpades,
          ],
        },
        { id: 'carol', hand: [cards.sixClubs, sixDiamonds, cards.sixSpades, cards.sevenClubs] },
      ],
      currentPlayer: 'alice',
      battle: { enemy: jackHearts, damageDealt: 0, playedCards: [], immunityCancelled: false },
      tavern: [
        cards.sevenHearts,
        cards.sevenDiamonds,
        cards.eightClubs,
        cards.eightDiamonds,
        cards.eightHearts,
      ],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
  const snapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);
  // Without her draws, Alice's remaining hand is worth only 9, less than retaliation's 10.
  assert.equal(
    initial.world.players[0]?.hand
      .slice(1)
      .reduce((total, card) => total + (card.kind === 'number' ? card.rank : 0), 0),
    9,
  );

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [cards.fourDiamonds.id],
  });

  assert.deepEqual(initial, snapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [
    cards.twoClubs,
    cards.twoDiamonds,
    cards.threeClubs,
    twoHearts,
    cards.sevenHearts,
    cards.eightClubs,
  ]);
  assert.deepEqual(handOf(afterPlay, 'bob'), initial.world.players[1]?.hand);
  assert.deepEqual(handOf(afterPlay, 'carol'), [
    cards.sixClubs,
    sixDiamonds,
    cards.sixSpades,
    cards.sevenClubs,
    cards.sevenDiamonds,
    cards.eightDiamonds,
  ]);
  assert.deepEqual(afterPlay.world.tavern, [cards.eightHearts]);
  assert.deepEqual(afterPlay.world.battle.playedCards, [cards.fourDiamonds]);
  assert.equal(afterPlay.world.battle.damageDealt, 4);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Diamonds stop drawing when Tavern is exhausted and still deal damage and face retaliation', () => {
  const drawCard = {
    kind: 'number',
    id: 'five-hearts',
    rank: 5,
    suit: 'hearts',
  } as const satisfies Card;
  const sixHearts = {
    kind: 'number',
    id: 'six-hearts',
    rank: 6,
    suit: 'hearts',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [
        { id: 'alice', hand: [threeDiamonds, fiveClubs, sixHearts] },
        { id: 'bob', hand: [twoHearts] },
      ],
      currentPlayer: 'alice',
      battle: { enemy: jackHearts, damageDealt: 0, playedCards: [], immunityCancelled: false },
      tavern: [drawCard],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
  const snapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeDiamonds.id],
  });

  assert.deepEqual(initial, snapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [fiveClubs, sixHearts, drawCard]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [twoHearts]);
  assert.deepEqual(afterPlay.world.tavern, []);
  assert.deepEqual(afterPlay.world.battle.playedCards, [threeDiamonds]);
  assert.equal(afterPlay.world.battle.damageDealt, 3);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Diamonds stop drawing when all players reach their hand limit', () => {
  const threeClubs = {
    kind: 'number',
    id: 'three-clubs',
    rank: 3,
    suit: 'clubs',
  } as const satisfies Card;
  // Use eight distinct cards in the solo hand.
  const soloHand = [
    threeDiamonds,
    fiveClubs,
    sixDiamonds,
    fourSpades,
    twoHearts,
    threeClubs,
    {
      kind: 'number',
      id: 'seven-hearts',
      rank: 7,
      suit: 'hearts',
    } as const satisfies Card,
    {
      kind: 'number',
      id: 'eight-hearts',
      rank: 8,
      suit: 'hearts',
    } as const satisfies Card,
  ];
  const drawCard = {
    kind: 'number',
    id: 'nine-hearts',
    rank: 9,
    suit: 'hearts',
  } as const satisfies Card;
  const leftover = {
    kind: 'number',
    id: 'ten-hearts',
    rank: 10,
    suit: 'hearts',
  } as const satisfies Card;
  const initial: GameState = {
    world: {
      players: [{ id: 'alice', hand: soloHand }],
      currentPlayer: 'alice',
      battle: { enemy: jackHearts, damageDealt: 0, playedCards: [], immunityCancelled: false },
      tavern: [drawCard, leftover],
      discard: [],
      castle: [],
    },
    decision: { kind: 'await-turn-action' },
  };
  const snapshot = structuredClone(initial);
  const originalIds = allCardIds(initial);

  const afterPlay = transition(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeDiamonds.id],
  });

  assert.deepEqual(initial, snapshot);
  assert.deepEqual(handOf(afterPlay, 'alice'), [...soloHand.slice(1), drawCard]);
  assert.deepEqual(afterPlay.world.tavern, [leftover]);
  assert.equal(afterPlay.world.battle.damageDealt, 3);
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('play validation rejects the wrong actor, unavailable cards, and unsupported plays', () => {
  const state = initialState();
  const actions: Action[] = [
    { kind: 'play-cards', playerId: 'bob', cardIds: [fiveClubs.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [threeDiamonds.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: ['missing-card'] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, fiveClubs.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, sixDiamonds.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [twoHearts.id] },
  ];

  for (const action of actions) assertRejectedWithoutMutation(state, action);
  assertRejectedWithoutMutation(state, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [sixDiamonds.id, fourSpades.id],
  });
});

void test('damage discard validation rejects the wrong actor, unavailable cards, and insufficient value', () => {
  const state = transition(initialState(), {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fiveClubs.id],
  });
  const actions: Action[] = [
    { kind: 'discard-for-damage', playerId: 'bob', cardIds: [sixDiamonds.id, fourSpades.id] },
    { kind: 'discard-for-damage', playerId: 'alice', cardIds: [fiveClubs.id, fourSpades.id] },
    { kind: 'discard-for-damage', playerId: 'alice', cardIds: ['missing-card'] },
    { kind: 'discard-for-damage', playerId: 'alice', cardIds: [sixDiamonds.id, sixDiamonds.id] },
    { kind: 'discard-for-damage', playerId: 'alice', cardIds: [sixDiamonds.id] },
  ];

  for (const action of actions) assertRejectedWithoutMutation(state, action);
  assertRejectedWithoutMutation(state, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [sixDiamonds.id],
  });
});
