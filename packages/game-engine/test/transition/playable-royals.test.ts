import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Card } from '../../src/index.ts';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  assertRejectedWithoutMutation,
  handOf,
  transitionWithBattle,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

for (const { rank, value } of [
  { rank: 'jack', value: 10 },
  { rank: 'queen', value: 15 },
  { rank: 'king', value: 20 },
] as const) {
  void test(`playing a ${rank} attacks for ${value} and its Spades shield uses the full value`, () => {
    const royal = makeRoyal(rank, 'spades');
    const reserve = [makeCard(10, 'clubs'), makeCard(10, 'diamonds')];
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [royal, ...reserve] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('king', 'hearts'),
    });
    const after = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [royal.id],
    });

    assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [royal] }]);
    assert.equal(after.world.battle.damageDealt, value);
    assert.deepEqual(
      after.decision,
      value === 20
        ? { kind: 'await-turn-action' }
        : { kind: 'await-damage-discard', requiredDamage: 20 - value },
    );
    assert.deepEqual(handOf(after, 'alice'), reserve);
    assertCardsInExactlyOneZone(after, allCardIds(initial));
  });
}

void test('a Royal Clubs attack doubles its full value', () => {
  const queen = makeRoyal('queen', 'clubs');
  const reserve = [makeCard(10, 'hearts'), makeCard(10, 'spades')];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [queen, ...reserve] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('king', 'hearts'),
  });
  const after = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [queen.id],
  });

  assert.equal(after.world.battle.damageDealt, 30);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [queen] }]);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 20 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('matching enemy suit immunity blocks a Royal suit power but not its attack', () => {
  const queen = makeRoyal('queen', 'clubs');
  const reserve = [makeCard(10, 'hearts'), makeCard(10, 'spades')];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [queen, ...reserve] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('king', 'clubs'),
  });
  const after = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [queen.id],
  });

  assert.equal(after.world.battle.damageDealt, 15);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 20 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

for (const animalFirst of [false, true]) {
  void test(`a Royal pairs with an Animal Companion with ${animalFirst ? 'Animal first' : 'Royal first'}`, () => {
    const jack = makeRoyal('jack', 'hearts');
    const companion = { kind: 'animal', id: 'animal-clubs', suit: 'clubs' } as const;
    const reserve = [makeCard(10, 'diamonds'), makeCard(10, 'spades')];
    const cards = animalFirst ? [companion, jack] : [jack, companion];
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [jack, companion, ...reserve] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('king', 'diamonds'),
    });
    const after = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: cards.map((card) => card.id),
    });

    assert.equal(after.world.battle.damageDealt, 22);
    assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards }]);
    assert.deepEqual(handOf(after, 'alice'), reserve);
    assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 20 });
    assertCardsInExactlyOneZone(after, allCardIds(initial));
  });
}

void test('Royals cannot be used in numbered combos', () => {
  const jack = makeRoyal('jack', 'hearts');
  const otherJack = makeRoyal('jack', 'spades');
  const ten = makeCard(10, 'clubs');
  const two = makeCard(2, 'diamonds');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [jack, otherJack, ten, two] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('king', 'diamonds'),
  });

  for (const cards of [
    [jack, otherJack],
    [jack, ten],
    [two, jack],
    [jack, two, ten],
  ] satisfies readonly (readonly Card[])[]) {
    assertRejectedWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: cards.map((card) => card.id),
    });
  }
});

void test('a defeated Royal drawn from the Tavern can be played and activate Hearts', () => {
  const two = makeCard(2, 'diamonds');
  const firstDiscard = makeCard(10, 'clubs');
  const secondDiscard = makeCard(10, 'spades');
  const jack = makeRoyal('jack', 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [two, firstDiscard, secondDiscard] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    tavern: [jack],
  });
  const afterDraw = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [two.id],
  });
  assert.deepEqual(handOf(afterDraw, 'alice'), [firstDiscard, secondDiscard, jack]);
  assert.deepEqual(afterDraw.world.tavern, []);
  const afterDiscard = transitionWithBattle(afterDraw, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [firstDiscard.id],
  });
  const afterRoyal = transitionWithBattle(afterDiscard, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jack.id],
  });

  assert.deepEqual(afterRoyal.world.battle.plays, [
    { kind: 'attack', cards: [two] },
    { kind: 'attack', cards: [jack] },
  ]);
  assert.equal(afterRoyal.world.battle.damageDealt, 12);
  assert.deepEqual(afterRoyal.world.tavern, [firstDiscard]);
  assert.deepEqual(afterRoyal.world.discard, []);
  assert.deepEqual(handOf(afterRoyal, 'alice'), [secondDiscard]);
  assert.deepEqual(afterRoyal.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterRoyal, allCardIds(initial));
});
