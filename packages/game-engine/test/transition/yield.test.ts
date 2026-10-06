import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  assertRejectedWithoutMutation,
  handOf,
  transitionWithoutMutation,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('yield during await-turn-action skips suit powers and damage but still requires retaliation', () => {
  const earlierSpades = makeCard(4, 'spades');
  const sixHearts = makeCard(6, 'hearts');
  const threeDiamonds = makeCard(3, 'diamonds');
  const twoClubs = makeCard(2, 'clubs');
  const fiveSpades = makeCard(5, 'spades');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [sixHearts, threeDiamonds] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'clubs'),
    damageDealt: 4,
    plays: [{ kind: 'attack', cards: [earlierSpades] }],
    tavern: [fiveSpades],
    discard: [twoClubs],
  });
  const originalIds = allCardIds(initial);

  const afterYield = transitionWithoutMutation(initial, { kind: 'yield', playerId: 'alice' });
  assert.deepEqual(afterYield.decision, { kind: 'await-damage-discard', requiredDamage: 6 });
  assert.equal(afterYield.world.currentPlayer, 'alice');
  assert.deepEqual(afterYield.world.battle, initial.world.battle);
  assert.deepEqual(afterYield.world.tavern, initial.world.tavern);
  assert.deepEqual(afterYield.world.discard, initial.world.discard);
  assert.equal(afterYield.world.rngState, initial.world.rngState);
  assert.deepEqual(handOf(afterYield, 'alice'), [sixHearts, threeDiamonds]);
  assertCardsInExactlyOneZone(afterYield, originalIds);

  assertRejectedWithoutMutation(afterYield, { kind: 'yield', playerId: 'alice' });
  const afterDiscard = transitionWithoutMutation(afterYield, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [sixHearts.id],
  });
  assert.equal(afterDiscard.world.currentPlayer, 'bob');
  assert.deepEqual(afterDiscard.decision, { kind: 'await-turn-action' });
  assert.deepEqual(afterDiscard.world.discard, [twoClubs, sixHearts]);
  assertCardsInExactlyOneZone(afterDiscard, originalIds);
});

void test('yield is rejected during next-player choice without changing state', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [jester] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
  });
  const originalIds = allCardIds(initial);

  const afterJester = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jester.id],
  });
  assert.deepEqual(afterJester.decision, { kind: 'await-next-player-choice' });
  assertRejectedWithoutMutation(afterJester, { kind: 'yield', playerId: 'alice' });
  assertCardsInExactlyOneZone(afterJester, originalIds);
});

void test('yield advances directly to the next player when existing Spades block all retaliation', () => {
  const tenSpades = makeCard(10, 'spades');
  const twoHearts = makeCard(2, 'hearts');
  const threeClubs = makeCard(3, 'clubs');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [twoHearts] },
      { id: 'bob', hand: [threeClubs] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    plays: [{ kind: 'attack', cards: [tenSpades] }],
    damageDealt: 10,
  });
  const originalIds = allCardIds(initial);

  const afterYield = transitionWithoutMutation(initial, { kind: 'yield', playerId: 'alice' });
  assert.deepEqual(afterYield.decision, { kind: 'await-turn-action' });
  assert.equal(afterYield.world.currentPlayer, 'bob');
  assert.deepEqual(afterYield.world.battle, initial.world.battle);
  assert.deepEqual(afterYield.world.players, initial.world.players);
  assertCardsInExactlyOneZone(afterYield, originalIds);
});

void test('after two consecutive yields in a three-player game the third cannot yield; a play resets the streak', () => {
  const tenSpades = makeCard(10, 'spades');
  const twoHearts = makeCard(2, 'hearts');
  const threeHearts = makeCard(3, 'hearts');
  const fourHearts = makeCard(4, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [twoHearts] },
      { id: 'bob', hand: [threeHearts] },
      { id: 'carol', hand: [fourHearts] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    plays: [{ kind: 'attack', cards: [tenSpades] }],
    damageDealt: 10,
  });
  const originalIds = allCardIds(initial);

  const afterAlice = transitionWithoutMutation(initial, { kind: 'yield', playerId: 'alice' });
  assertCardsInExactlyOneZone(afterAlice, originalIds);

  const afterBob = transitionWithoutMutation(afterAlice, { kind: 'yield', playerId: 'bob' });
  assert.equal(afterBob.world.currentPlayer, 'carol');
  assertCardsInExactlyOneZone(afterBob, originalIds);
  assertRejectedWithoutMutation(afterBob, { kind: 'yield', playerId: 'carol' });

  const afterCarolPlay = transitionWithoutMutation(afterBob, {
    kind: 'play-cards',
    playerId: 'carol',
    cardIds: [fourHearts.id],
  });
  assert.equal(afterCarolPlay.world.currentPlayer, 'alice');
  assertCardsInExactlyOneZone(afterCarolPlay, originalIds);

  const afterAliceAgain = transitionWithoutMutation(afterCarolPlay, {
    kind: 'yield',
    playerId: 'alice',
  });
  const afterBobAgain = transitionWithoutMutation(afterAliceAgain, {
    kind: 'yield',
    playerId: 'bob',
  });
  assertRejectedWithoutMutation(afterBobAgain, { kind: 'yield', playerId: 'carol' });
  assertCardsInExactlyOneZone(afterBobAgain, originalIds);
});

void test('in a two-player game one yield prevents the next player from yielding', () => {
  const tenSpades = makeCard(10, 'spades');
  const twoHearts = makeCard(2, 'hearts');
  const threeHearts = makeCard(3, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [twoHearts] },
      { id: 'bob', hand: [threeHearts] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    plays: [{ kind: 'attack', cards: [tenSpades] }],
    damageDealt: 10,
  });
  const originalIds = allCardIds(initial);

  const afterAlice = transitionWithoutMutation(initial, { kind: 'yield', playerId: 'alice' });
  assertRejectedWithoutMutation(afterAlice, { kind: 'yield', playerId: 'bob' });
  const afterBobPlay = transitionWithoutMutation(afterAlice, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [threeHearts.id],
  });
  const afterAliceAgain = transitionWithoutMutation(afterBobPlay, {
    kind: 'yield',
    playerId: 'alice',
  });
  assertRejectedWithoutMutation(afterAliceAgain, { kind: 'yield', playerId: 'bob' });
  assertCardsInExactlyOneZone(afterAliceAgain, originalIds);
});
