import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  assertRejectedWithoutMutation,
  handOf,
  transitionWithBattle,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('unsurvivable retaliation ends the game without losing cards or mutating the input', () => {
  const attack = makeCard(3, 'clubs');
  const reserve = makeCard(2, 'diamonds');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [attack, reserve] },
      { id: 'bob', hand: [makeCard(4, 'hearts')] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
  });
  const originalIds = allCardIds(state);
  const lost = transitionWithBattle(state, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });

  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.decision, undefined);
  assert.equal(lost.world.currentPlayer, 'alice');
  assert.deepEqual(handOf(lost, 'alice'), [reserve]);
  assert.deepEqual(lost.world.battle.plays, [{ kind: 'attack', cards: [attack] }]);
  assert.equal(lost.world.battle.damageDealt, 6);
  assertCardsInExactlyOneZone(lost, originalIds);
  assertRejectedWithoutMutation(lost, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [reserve.id],
  });
  assertRejectedWithoutMutation(lost, { kind: 'yield', playerId: 'alice' });
  assertRejectedWithoutMutation(lost, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [reserve.id],
  });
});

void test('solo retaliation with an insufficient hand permits explicitly accepting defeat', () => {
  const attack = makeCard(2, 'clubs');
  const weak = makeCard(3, 'hearts');
  const state = makeGameState({
    players: [{ id: 'alice', hand: [attack, weak] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    soloJestersUsed: 0,
  });
  const retaliation = transitionWithBattle(state, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(retaliation.kind, 'active');
  assert.deepEqual(retaliation.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });

  const lost = transitionWithBattle(retaliation, {
    kind: 'accept-defeat',
    playerId: 'alice',
  });
  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.decision, undefined);
  assert.deepEqual(handOf(lost, 'alice'), [weak]);
  assertCardsInExactlyOneZone(lost, allCardIds(state));
});

void test('a sufficient discard can empty the hand and still advance to a playable next turn', () => {
  const attack = makeCard(2, 'clubs');
  const ten = makeCard(10, 'hearts');
  const next = makeCard(3, 'diamonds');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [attack, ten] },
      { id: 'bob', hand: [next] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'diamonds'),
  });
  const originalIds = allCardIds(state);
  const retaliation = transitionWithBattle(state, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(retaliation.kind, 'active');
  assert.deepEqual(retaliation.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });

  const after = transitionWithBattle(retaliation, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [ten.id],
  });
  assert.equal(after.kind, 'active');
  assert.deepEqual(after.decision, { kind: 'await-turn-action' });
  assert.equal(after.world.currentPlayer, 'bob');
  assert.deepEqual(handOf(after, 'alice'), []);
  assert.deepEqual(after.world.discard, [ten]);
  assertCardsInExactlyOneZone(after, originalIds);
});

void test('entering a turn with an empty hand and prohibited yield ends the game', () => {
  const spade = makeCard(10, 'spades');
  const reserve = makeCard(2, 'hearts');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [reserve] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    plays: [{ kind: 'attack', cards: [spade] }],
    damageDealt: 10,
  });
  const originalIds = allCardIds(state);
  const lost = transitionWithBattle(state, { kind: 'yield', playerId: 'alice' });

  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.decision, undefined);
  assert.equal(lost.world.currentPlayer, 'bob');
  assert.deepEqual(lost.world.players, state.world.players);
  assert.deepEqual(lost.world.battle, state.world.battle);
  assertCardsInExactlyOneZone(lost, originalIds);
  assertRejectedWithoutMutation(lost, { kind: 'yield', playerId: 'bob' });
});

void test('turn entry after a sufficient damage discard also checks for loss', () => {
  const ten = makeCard(10, 'hearts');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [ten] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'diamonds'),
    consecutiveYields: 1,
    decision: { kind: 'await-retaliation-action', requiredDamage: 10 },
  });
  const lost = transitionWithBattle(state, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [ten.id],
  });

  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.world.currentPlayer, 'bob');
  assert.deepEqual(lost.world.discard, [ten]);
  assertCardsInExactlyOneZone(lost, allCardIds(state));
});

void test('an empty-handed player can enter a turn if yielding is legal', () => {
  const shield = makeCard(9, 'spades');
  const attack = makeCard(2, 'spades');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [attack] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'diamonds'),
    plays: [{ kind: 'attack', cards: [shield] }],
    damageDealt: 9,
    consecutiveYields: 1,
  });
  const after = transitionWithBattle(state, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(after.kind, 'active');
  assert.deepEqual(after.decision, { kind: 'await-turn-action' });
  assert.equal(after.world.currentPlayer, 'bob');
  assert.deepEqual(handOf(after, 'bob'), []);
  assertCardsInExactlyOneZone(after, allCardIds(state));

  const afterBobYields = transitionWithBattle(after, { kind: 'yield', playerId: 'bob' });
  assert.equal(afterBobYields.kind, 'game-over');
  assert.equal(afterBobYields.result, 'loss');
  assert.equal(afterBobYields.world.currentPlayer, 'alice');
  assertCardsInExactlyOneZone(afterBobYields, allCardIds(state));
});
