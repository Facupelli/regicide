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
    playedCards: [eightClubs],
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
    playedCards: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
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
    playedCards: [sevenClubs],
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
    playedCards: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [queenSpades]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
