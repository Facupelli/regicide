import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  handOf,
  transitionWithBattle,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('Spades shield persists across turns and accumulates against a Queen', () => {
  const fourSpades = makeCard(4, 'spades');
  const tenDiamonds = makeCard(10, 'diamonds');
  const twoClubs = makeCard(2, 'clubs');
  const twoSpades = makeCard(2, 'spades');
  const tenHearts = makeCard(10, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [fourSpades, tenDiamonds, twoClubs] },
      { id: 'bob', hand: [twoSpades, tenHearts] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('queen', 'hearts'),
  });
  const originalIds = allCardIds(initial);

  const afterAlicePlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fourSpades.id],
  });
  assert.deepEqual(handOf(afterAlicePlay, 'alice'), [tenDiamonds, twoClubs]);
  assert.deepEqual(afterAlicePlay.world.battle.plays, [{ kind: 'attack', cards: [fourSpades] }]);
  assert.equal(afterAlicePlay.world.battle.damageDealt, 4);
  assert.equal(afterAlicePlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterAlicePlay.decision, { kind: 'await-damage-discard', requiredDamage: 11 });
  assertCardsInExactlyOneZone(afterAlicePlay, originalIds);

  const afterAliceDiscard = transitionWithBattle(afterAlicePlay, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [tenDiamonds.id, twoClubs.id],
  });
  assert.deepEqual(handOf(afterAliceDiscard, 'alice'), []);
  assert.deepEqual(afterAliceDiscard.world.discard, [tenDiamonds, twoClubs]);
  assert.deepEqual(afterAliceDiscard.world.battle.plays, [{ kind: 'attack', cards: [fourSpades] }]);
  assert.equal(afterAliceDiscard.world.battle.damageDealt, 4);
  assert.equal(afterAliceDiscard.world.currentPlayer, 'bob');
  assert.deepEqual(afterAliceDiscard.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterAliceDiscard, originalIds);

  const afterBobPlay = transitionWithBattle(afterAliceDiscard, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [twoSpades.id],
  });
  assert.deepEqual(handOf(afterBobPlay, 'bob'), [tenHearts]);
  assert.deepEqual(afterBobPlay.world.battle.plays, [
    { kind: 'attack', cards: [fourSpades] },
    { kind: 'attack', cards: [twoSpades] },
  ]);
  assert.equal(afterBobPlay.world.battle.damageDealt, 6);
  assert.deepEqual(afterBobPlay.world.discard, [tenDiamonds, twoClubs]);
  assert.equal(afterBobPlay.world.currentPlayer, 'bob');
  assert.deepEqual(afterBobPlay.decision, { kind: 'await-damage-discard', requiredDamage: 9 });
  assertCardsInExactlyOneZone(afterBobPlay, originalIds);
});

void test('Spades that fully shield retaliation advance the turn without a discard decision', () => {
  const eightSpades = makeCard(8, 'spades');
  const twoSpades = makeCard(2, 'spades');
  const threeDiamonds = makeCard(3, 'diamonds');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [twoSpades] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    damageDealt: 8,
    plays: [{ kind: 'attack', cards: [eightSpades] }],
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoSpades.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), []);
  assert.deepEqual(afterPlay.world.battle.plays, [
    { kind: 'attack', cards: [eightSpades] },
    { kind: 'attack', cards: [twoSpades] },
  ]);
  assert.equal(afterPlay.world.battle.damageDealt, 10);
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.currentPlayer, 'bob');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
