import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  handOf,
  transitionWithoutMutation,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('overkill defeats the enemy and gives the defeating player another turn', () => {
  const eightClubs = makeCard(8, 'clubs');
  const threeClubs = makeCard(3, 'clubs');
  const sixDiamonds = makeCard(6, 'diamonds');
  const threeDiamonds = makeCard(3, 'diamonds');
  const jackHearts = makeRoyal('jack', 'hearts');
  const jackDiamonds = makeRoyal('jack', 'diamonds');
  const queenSpades = makeRoyal('queen', 'spades');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [threeClubs, sixDiamonds] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: jackHearts,
    damageDealt: 16,
    plays: [{ kind: 'attack', cards: [eightClubs] }],
    castle: [jackDiamonds, queenSpades],
  });
  const originalIds = allCardIds(initial);
  assertCardsInExactlyOneZone(initial, originalIds);

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeClubs.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [sixDiamonds]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterPlay.world.discard, [jackHearts, eightClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.tavern, []);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: jackDiamonds,
    damageDealt: 0,
    plays: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('defeat moves all cards from separate attacks, an Animal pair, and a Jester exactly once', () => {
  const eightClubs = makeCard(8, 'clubs');
  const companion = { kind: 'animal', id: 'animal-hearts', suit: 'hearts' } as const;
  const twoSpades = makeCard(2, 'spades');
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const twoClubs = makeCard(2, 'clubs');
  const existingDiscard = makeCard(3, 'diamonds');
  const enemy = makeRoyal('jack', 'hearts');
  const nextEnemy = makeRoyal('jack', 'diamonds');
  const followingEnemy = makeRoyal('queen', 'spades');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [twoClubs] }],
    currentPlayer: 'alice',
    enemy,
    damageDealt: 19,
    immunityCancelled: true,
    plays: [
      { kind: 'attack', cards: [eightClubs] },
      { kind: 'attack', cards: [companion, twoSpades] },
      { kind: 'jester', card: jester },
    ],
    discard: [existingDiscard],
    castle: [nextEnemy, followingEnemy],
  });
  const originalIds = allCardIds(initial);
  assertCardsInExactlyOneZone(initial, originalIds);

  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoClubs.id],
  });

  assert.deepEqual(after.world.discard, [
    existingDiscard,
    enemy,
    eightClubs,
    companion,
    twoSpades,
    jester,
    twoClubs,
  ]);
  assert.deepEqual(after.world.battle, {
    enemy: nextEnemy,
    damageDealt: 0,
    plays: [],
    immunityCancelled: false,
  });
  assert.deepEqual(after.world.castle, [followingEnemy]);
  assert.deepEqual(handOf(after, 'alice'), []);
  assert.deepEqual(after.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(after, originalIds);
});

void test('exact damage puts the enemy on top of Tavern and gives the defeating player another turn', () => {
  const sevenClubs = makeCard(7, 'clubs');
  const threeClubs = makeCard(3, 'clubs');
  const fiveClubs = makeCard(5, 'clubs');
  const threeDiamonds = makeCard(3, 'diamonds');
  const twoHearts = makeCard(2, 'hearts');
  const sixDiamonds = makeCard(6, 'diamonds');
  const jackHearts = makeRoyal('jack', 'hearts');
  const jackDiamonds = makeRoyal('jack', 'diamonds');
  const queenSpades = makeRoyal('queen', 'spades');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [threeClubs, fiveClubs] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: jackHearts,
    damageDealt: 14,
    plays: [{ kind: 'attack', cards: [sevenClubs] }],
    tavern: [twoHearts, sixDiamonds],
    castle: [jackDiamonds, queenSpades],
  });
  const originalIds = allCardIds(initial);
  assertCardsInExactlyOneZone(initial, originalIds);

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeClubs.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [fiveClubs]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterPlay.world.tavern, [jackHearts, twoHearts, sixDiamonds]);
  assert.deepEqual(afterPlay.world.discard, [sevenClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: jackDiamonds,
    damageDealt: 0,
    plays: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
