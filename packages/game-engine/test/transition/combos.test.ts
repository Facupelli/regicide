import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Card } from '../../src/index.ts';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  assertRejectedWithoutMutation,
  handOf,
  transitionWithoutMutation,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

const suits = ['hearts', 'diamonds', 'spades', 'clubs'] as const;

for (const [rank, count] of [
  [2, 2],
  [3, 2],
  [4, 2],
  [5, 2],
  [2, 3],
  [3, 3],
  [2, 4],
] as const) {
  void test(`${count} numbered ${rank}s form a combo with attack value ${rank * count}`, () => {
    const cards = suits.slice(0, count).map((suit) => makeCard(rank, suit));
    const reserve = makeCard(10, 'hearts');
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [reserve, ...cards] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'clubs'),
    });
    const after = transitionWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: cards.map((card) => card.id),
    });

    assert.deepEqual(handOf(after, 'alice'), [reserve]);
    assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards }]);
    assert.equal(after.world.battle.damageDealt, rank * count);
    assertCardsInExactlyOneZone(after, allCardIds(initial));
  });
}

void test('a three-suit combo applies the full attack value to draw, shield, and damage', () => {
  const cards = [makeCard(3, 'diamonds'), makeCard(3, 'spades'), makeCard(3, 'clubs')];
  const reserve = makeCard(10, 'hearts');
  const tavern = [
    makeCard(2, 'hearts'),
    makeCard(4, 'hearts'),
    makeCard(5, 'hearts'),
    makeCard(6, 'hearts'),
    makeCard(7, 'hearts'),
    makeCard(8, 'hearts'),
    makeCard(9, 'hearts'),
    makeCard(2, 'spades'),
    makeCard(4, 'spades'),
  ];
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [reserve, ...cards] },
      { id: 'bob', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    tavern,
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: cards.map((card) => card.id),
  });

  assert.deepEqual(handOf(after, 'alice'), [reserve, ...tavern.filter((_, i) => i % 2 === 0)]);
  assert.deepEqual(
    handOf(after, 'bob'),
    tavern.filter((_, i) => i % 2 === 1),
  );
  assert.deepEqual(after.world.tavern, []);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards }]);
  assert.equal(after.world.battle.damageDealt, 18);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 1 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('combo Hearts heal the Tavern before combo Diamonds draw from it', () => {
  const cards = [makeCard(2, 'diamonds'), makeCard(2, 'hearts')];
  const reserve = makeCard(10, 'clubs');
  const discard = [
    makeCard(3, 'spades'),
    makeCard(4, 'spades'),
    makeCard(5, 'spades'),
    makeCard(6, 'spades'),
  ];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [reserve, ...cards] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    discard,
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: cards.map((card) => card.id),
  });

  assert.deepEqual(handOf(after, 'alice').slice(0, 1), [reserve]);
  assert.deepEqual(
    handOf(after, 'alice')
      .slice(1)
      .map((card) => card.id)
      .toSorted(),
    discard.map((card) => card.id).toSorted(),
  );
  assert.deepEqual(after.world.tavern, []);
  assert.deepEqual(after.world.discard, []);
  assert.equal(after.world.battle.damageDealt, 4);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards }]);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

for (const immuneSuit of suits) {
  void test(`combo against Jack of ${immuneSuit} suppresses only ${immuneSuit} power`, () => {
    const cards = suits.map((suit) => makeCard(2, suit));
    const reserve = makeCard(10, 'clubs');
    const healed = makeCard(3, 'clubs');
    const tavernCard = makeCard(4, 'clubs');
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [reserve, ...cards] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', immuneSuit),
      tavern: [tavernCard],
      discard: [healed],
    });
    const after = transitionWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: cards.map((card) => card.id),
    });

    const heartsActive = immuneSuit !== 'hearts';
    const diamondsActive = immuneSuit !== 'diamonds';
    const drawn = diamondsActive ? [tavernCard, ...(heartsActive ? [healed] : [])] : [];
    assert.deepEqual(handOf(after, 'alice'), [reserve, ...drawn]);
    assert.deepEqual(after.world.discard, heartsActive ? [] : [healed]);
    assert.deepEqual(
      after.world.tavern,
      diamondsActive ? [] : [tavernCard, ...(heartsActive ? [healed] : [])],
    );
    assert.equal(after.world.battle.damageDealt, immuneSuit === 'clubs' ? 8 : 16);
    assert.deepEqual(after.decision, {
      kind: 'await-damage-discard',
      requiredDamage: immuneSuit === 'spades' ? 10 : 2,
    });
    assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards }]);
    assertCardsInExactlyOneZone(after, allCardIds(initial));
  });
}

void test('mixed ranks, excessive totals, Animal Companions, Jesters, Royals, and more than four cards cannot form combos', () => {
  const twos = suits.map((suit) => makeCard(2, suit));
  const threes = suits.map((suit) => makeCard(3, suit));
  const fours = suits.map((suit) => makeCard(4, suit));
  const fives = suits.map((suit) => makeCard(5, suit));
  const six = makeCard(6, 'hearts');
  const otherSix = makeCard(6, 'spades');
  const animal = { kind: 'animal', id: 'animal-clubs', suit: 'clubs' } as const;
  const otherAnimal = { kind: 'animal', id: 'animal-spades', suit: 'spades' } as const;
  const jester = { kind: 'jester', id: 'jester-1' } as const;
  const royal = makeRoyal('queen', 'hearts');
  const extraTwo = { ...twos[0]!, id: 'other-two-hearts' };
  const initial = makeGameState({
    players: [
      {
        id: 'alice',
        hand: [
          ...twos,
          ...threes,
          ...fours,
          ...fives,
          six,
          otherSix,
          animal,
          otherAnimal,
          jester,
          royal,
          extraTwo,
        ],
      },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'diamonds'),
  });
  const invalid: readonly (readonly Card[])[] = [
    [twos[0]!, threes[1]!],
    [twos[0]!, twos[1]!, threes[2]!],
    [fours[0]!, fours[1]!, fours[2]!],
    [threes[0]!, threes[1]!, threes[2]!, threes[3]!],
    [fives[0]!, fives[1]!, fives[2]!],
    [six, otherSix],
    [twos[0]!, twos[1]!, animal],
    [animal, twos[0]!, twos[1]!],
    [animal, otherAnimal, twos[0]!],
    [twos[0]!, twos[1]!, jester],
    [jester, twos[0]!],
    [twos[0]!, twos[1]!, royal],
    [...twos, extraTwo],
  ];
  for (const cards of invalid) {
    assertRejectedWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: cards.map((card) => card.id),
    });
  }
});
