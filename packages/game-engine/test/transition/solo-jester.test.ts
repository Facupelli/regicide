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
import { canAcceptDefeat, canUseSoloJester } from '../../src/game-engine.ts';

void test('Step 1 solo Jester discards the entire hand and refills to 8 without changing the battle', () => {
  const oldHand = [makeCard(2, 'clubs'), makeCard(3, 'hearts')];
  const oldDiscard = makeCard(4, 'spades');
  const tavern = ([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((rank) => makeCard(rank, 'diamonds'));
  const initial = makeGameState({
    players: [{ id: 'alice', hand: oldHand }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'diamonds'),
    discard: [oldDiscard],
    tavern,
  });
  const after = transitionWithoutMutation(initial, { kind: 'use-solo-jester', playerId: 'alice' });

  assert.equal(after.kind, 'active');
  assert.deepEqual(after.decision, { kind: 'await-turn-action' });
  assert.equal(after.world.currentPlayer, 'alice');
  assert.equal(after.world.soloJestersUsed, 1);
  assert.deepEqual(handOf(after, 'alice'), tavern.slice(0, 8));
  assert.deepEqual(after.world.tavern, tavern.slice(8));
  assert.deepEqual(after.world.discard, [oldDiscard, ...oldHand]);
  assert.deepEqual(after.world.battle, initial.world.battle);
  assert.equal(after.world.rngState, initial.world.rngState);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
  assertRejectedWithoutMutation(after, { kind: 'accept-defeat', playerId: 'alice' });
});

void test('Step 1 permits consecutive uses, including a partial refill, but rejects a third use', () => {
  const oldHand = makeCard(2, 'hearts');
  const tavern = ([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((rank) => makeCard(rank, 'clubs'));
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [oldHand] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'diamonds'),
    tavern,
  });
  const first = transitionWithoutMutation(initial, { kind: 'use-solo-jester', playerId: 'alice' });
  const second = transitionWithoutMutation(first, { kind: 'use-solo-jester', playerId: 'alice' });

  assert.equal(second.kind, 'active');
  assert.deepEqual(second.decision, { kind: 'await-turn-action' });
  assert.equal(second.world.soloJestersUsed, 2);
  assert.deepEqual(handOf(second, 'alice'), [tavern[8]]);
  assert.deepEqual(second.world.discard, [oldHand, ...tavern.slice(0, 8)]);
  assert.deepEqual(second.world.tavern, []);
  assertRejectedWithoutMutation(second, { kind: 'use-solo-jester', playerId: 'alice' });
});

void test('an empty Tavern still consumes a use; turn-entry loss follows when no uses or cards remain', () => {
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'hearts'),
  });
  const first = transitionWithoutMutation(initial, { kind: 'use-solo-jester', playerId: 'alice' });
  assert.equal(first.kind, 'active');
  assert.equal(first.world.soloJestersUsed, 1);
  assert.deepEqual(first.decision, { kind: 'await-turn-action' });

  const second = transitionWithoutMutation(first, { kind: 'use-solo-jester', playerId: 'alice' });
  assert.equal(second.kind, 'game-over');
  assert.equal(second.result, 'loss');
  assert.equal(second.world.soloJestersUsed, 2);
  assertCardsInExactlyOneZone(second, allCardIds(initial));
});

void test('survivable solo retaliation offers discard and Jester as alternatives without a decline action', () => {
  const attack = makeCard(2, 'clubs');
  const reserve = makeCard(10, 'spades');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, reserve] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'diamonds'),
  });
  const retaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(retaliation.kind, 'active');
  assert.deepEqual(retaliation.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
  if (retaliation.kind !== 'active') return;
  assert.equal(canUseSoloJester(retaliation), true);
  assert.equal(canAcceptDefeat(retaliation), false);
  const nextTurn = transitionWithoutMutation(retaliation, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [reserve.id],
  });
  assert.equal(nextTurn.kind, 'active');
  assert.deepEqual(nextTurn.decision, { kind: 'await-turn-action' });
  assert.equal(nextTurn.world.soloJestersUsed, 0);
  assert.deepEqual(nextTurn.world.discard, [reserve]);
  assertCardsInExactlyOneZone(nextTurn, allCardIds(initial));
});

void test('a solo Jester can avert an otherwise fatal retaliation before damage is checked', () => {
  const attack = makeCard(2, 'spades');
  const weak = makeCard(2, 'clubs');
  const rescue = makeCard(10, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, weak] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'diamonds'),
    tavern: [rescue],
  });
  const beforeRetaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(beforeRetaliation.kind, 'active');
  assert.deepEqual(beforeRetaliation.decision, {
    kind: 'await-retaliation-action',
    requiredDamage: 8,
  });
  if (beforeRetaliation.kind !== 'active') return;
  assert.equal(canAcceptDefeat(beforeRetaliation), true);
  assert.equal(canUseSoloJester(beforeRetaliation), true);
  assertRejectedWithoutMutation(beforeRetaliation, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [weak.id],
  });
  const accepted = transitionWithoutMutation(beforeRetaliation, {
    kind: 'accept-defeat',
    playerId: 'alice',
  });
  assert.equal(accepted.kind, 'game-over');
  assert.equal(accepted.result, 'loss');

  const afterUse = transitionWithoutMutation(beforeRetaliation, {
    kind: 'use-solo-jester',
    playerId: 'alice',
  });
  assert.equal(afterUse.kind, 'active');
  assert.deepEqual(afterUse.decision, { kind: 'await-retaliation-action', requiredDamage: 8 });
  assert.equal(afterUse.world.soloJestersUsed, 1);
  assert.deepEqual(handOf(afterUse, 'alice'), [rescue]);
  assert.deepEqual(afterUse.world.discard, [weak]);
  if (afterUse.kind !== 'active') return;
  assert.equal(canAcceptDefeat(afterUse), false);
  assert.equal(canUseSoloJester(afterUse), true);
  const afterDiscard = transitionWithoutMutation(afterUse, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [rescue.id],
  });
  assert.equal(afterDiscard.kind, 'active');
  assert.deepEqual(afterDiscard.decision, { kind: 'await-turn-action' });
  assert.equal(afterDiscard.world.soloJestersUsed, 1);
});

void test('the solo Step 4 window also exists when shields reduce damage to zero', () => {
  const attack = makeCard(10, 'spades');
  const oldHand = makeCard(2, 'clubs');
  const refill = makeCard(3, 'diamonds');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, oldHand] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'hearts'),
    tavern: [refill],
  });
  const beforeRetaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(beforeRetaliation.kind, 'active');
  assert.deepEqual(beforeRetaliation.decision, {
    kind: 'await-retaliation-action',
    requiredDamage: 0,
  });
  assertRejectedWithoutMutation(beforeRetaliation, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [oldHand.id],
  });

  const afterUse = transitionWithoutMutation(beforeRetaliation, {
    kind: 'use-solo-jester',
    playerId: 'alice',
  });
  assert.deepEqual(afterUse.decision, { kind: 'await-retaliation-action', requiredDamage: 0 });
  assert.deepEqual(handOf(afterUse, 'alice'), [refill]);
  const continued = transitionWithoutMutation(afterUse, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [],
  });
  assert.equal(continued.kind, 'active');
  assert.deepEqual(continued.decision, { kind: 'await-turn-action' });
  assert.equal(continued.world.soloJestersUsed, 1);
  assertCardsInExactlyOneZone(continued, allCardIds(initial));
});

void test('Step 4 permits consecutive uses and resolves retaliation automatically after the last use', () => {
  const attack = makeCard(2, 'spades');
  const oldHand = makeCard(3, 'hearts');
  const tavern = ([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((rank) => makeCard(rank, 'clubs'));
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, oldHand] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'diamonds'),
    tavern,
  });
  const beforeRetaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  const first = transitionWithoutMutation(beforeRetaliation, {
    kind: 'use-solo-jester',
    playerId: 'alice',
  });
  assert.deepEqual(first.decision, { kind: 'await-retaliation-action', requiredDamage: 8 });
  const second = transitionWithoutMutation(first, { kind: 'use-solo-jester', playerId: 'alice' });

  assert.equal(second.kind, 'active');
  assert.deepEqual(second.decision, { kind: 'await-retaliation-action', requiredDamage: 8 });
  assert.equal(second.world.soloJestersUsed, 2);
  assert.deepEqual(handOf(second, 'alice'), [tavern[8]]);
  assert.deepEqual(second.world.discard, [oldHand, ...tavern.slice(0, 8)]);
  assertCardsInExactlyOneZone(second, allCardIds(initial));
  assertRejectedWithoutMutation(second, { kind: 'use-solo-jester', playerId: 'alice' });
});

void test('a last Jester refill that still cannot absorb damage ends in defeat', () => {
  const attack = makeCard(2, 'clubs');
  const weak = makeCard(2, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, weak] }],
    currentPlayer: 'alice',
    soloJestersUsed: 1,
    enemy: makeRoyal('jack', 'spades'),
    tavern: [makeCard(3, 'hearts')],
  });
  const retaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(retaliation.kind, 'active');
  const lost = transitionWithoutMutation(retaliation, {
    kind: 'use-solo-jester',
    playerId: 'alice',
  });
  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.world.soloJestersUsed, 2);
  assertCardsInExactlyOneZone(lost, allCardIds(initial));
});

void test('an empty-handed solo player can reach Step 1 while a Jester use remains', () => {
  const attack = makeCard(10, 'spades');
  const refill = makeCard(3, 'clubs');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'hearts'),
    tavern: [refill],
  });
  const beforeRetaliation = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  const nextTurn = transitionWithoutMutation(beforeRetaliation, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [],
  });
  assert.equal(nextTurn.kind, 'active');
  assert.deepEqual(nextTurn.decision, { kind: 'await-turn-action' });
  assert.deepEqual(handOf(nextTurn, 'alice'), []);

  const afterUse = transitionWithoutMutation(nextTurn, {
    kind: 'use-solo-jester',
    playerId: 'alice',
  });
  assert.equal(afterUse.kind, 'active');
  assert.deepEqual(handOf(afterUse, 'alice'), [refill]);
  assert.equal(afterUse.world.soloJestersUsed, 1);
  assertCardsInExactlyOneZone(afterUse, allCardIds(initial));
});

void test('exhausted solo Jesters leave fatal and fully shielded retaliation automatic', () => {
  const attack = makeCard(2, 'spades');
  const weak = makeCard(2, 'clubs');
  const fatal = makeGameState({
    players: [{ id: 'alice', hand: [attack, weak] }],
    currentPlayer: 'alice',
    soloJestersUsed: 2,
    enemy: makeRoyal('jack', 'diamonds'),
  });
  const lost = transitionWithoutMutation(fatal, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });
  assert.equal(lost.kind, 'game-over');
  assert.equal(lost.result, 'loss');
  assert.equal(lost.world.soloJestersUsed, 2);

  const shield = makeCard(10, 'spades');
  const fullyShielded = makeGameState({
    players: [{ id: 'alice', hand: [shield, weak] }],
    currentPlayer: 'alice',
    soloJestersUsed: 2,
    enemy: makeRoyal('jack', 'hearts'),
  });
  const nextTurn = transitionWithoutMutation(fullyShielded, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [shield.id],
  });
  assert.equal(nextTurn.kind, 'active');
  assert.deepEqual(nextTurn.decision, { kind: 'await-turn-action' });
  assert.equal(nextTurn.world.soloJestersUsed, 2);
  assertRejectedWithoutMutation(nextTurn, { kind: 'use-solo-jester', playerId: 'alice' });
});

void test('solo Jesters cannot be used in multiplayer or outside the two windows', () => {
  const multiplayer = makeGameState({
    players: [
      { id: 'alice', hand: [makeCard(2, 'clubs')] },
      { id: 'bob', hand: [makeCard(3, 'clubs')] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
  });
  assertRejectedWithoutMutation(multiplayer, { kind: 'use-solo-jester', playerId: 'alice' });
  assertRejectedWithoutMutation(multiplayer, { kind: 'accept-defeat', playerId: 'alice' });
  const solo = makeGameState({
    players: [{ id: 'alice', hand: [makeCard(2, 'clubs')] }],
    currentPlayer: 'alice',
    soloJestersUsed: 0,
    enemy: makeRoyal('jack', 'hearts'),
    decision: { kind: 'await-retaliation-action', requiredDamage: 2 },
  });
  assertRejectedWithoutMutation(solo, { kind: 'accept-defeat', playerId: 'alice' });
  assertRejectedWithoutMutation(solo, { kind: 'use-solo-jester', playerId: 'bob' });
});
