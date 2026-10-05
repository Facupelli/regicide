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

void test('play validation rejects the wrong actor, unavailable cards, and unsupported plays', () => {
  const state = initialState();
  const actions: Action[] = [
    { kind: 'play-cards', playerId: 'bob', cardIds: [fiveClubs.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [threeDiamonds.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: ['missing-card'] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, fiveClubs.id] },
    { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, sixDiamonds.id] },
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
