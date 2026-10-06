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

type Animal = Extract<Card, { kind: 'animal' }>;
function animal(suit: Animal['suit']): Animal {
  return { kind: 'animal', id: `animal-${suit}`, suit };
}

void test('an Animal Companion alone attacks for 1 and activates its suit power', () => {
  const heart = animal('hearts');
  const discarded = makeCard(2, 'clubs');
  const ten = makeCard(10, 'diamonds');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [heart, ten] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    discard: [discarded],
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [heart.id],
  });
  assert.deepEqual(after.world.tavern, [discarded]);
  assert.deepEqual(after.world.discard, []);
  assert.deepEqual(handOf(after, 'alice'), [ten]);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [heart] }]);
  assert.equal(after.world.battle.damageDealt, 1);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('8 Diamonds paired with Animal Clubs draws 9 and deals 18 damage', () => {
  const eight = makeCard(8, 'diamonds');
  const club = animal('clubs');
  const ten = makeCard(10, 'hearts');
  const bobCard = makeCard(10, 'spades');
  const tavern = [
    makeCard(2, 'hearts'),
    makeCard(3, 'hearts'),
    makeCard(4, 'hearts'),
    makeCard(5, 'hearts'),
    makeCard(6, 'hearts'),
    makeCard(7, 'hearts'),
    makeCard(2, 'spades'),
    makeCard(3, 'spades'),
    makeCard(4, 'spades'),
    makeCard(5, 'spades'),
  ];
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [eight, club, ten] },
      { id: 'bob', hand: [bobCard] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    tavern,
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [eight.id, club.id],
  });
  assert.deepEqual(handOf(after, 'alice'), [
    ten,
    tavern[0],
    tavern[2],
    tavern[4],
    tavern[6],
    tavern[8],
  ]);
  assert.deepEqual(handOf(after, 'bob'), [bobCard, tavern[1], tavern[3], tavern[5], tavern[7]]);
  assert.deepEqual(after.world.tavern, [tavern[9]]);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [eight, club] }]);
  assert.equal(after.world.battle.damageDealt, 18);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('two Animal Companions can pair and both powers use their combined value', () => {
  const heart = animal('hearts');
  const spade = animal('spades');
  const ten = makeCard(10, 'diamonds');
  const discard = [makeCard(2, 'clubs'), makeCard(3, 'clubs'), makeCard(4, 'clubs')];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [heart, spade, ten] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'clubs'),
    discard,
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [heart.id, spade.id],
  });
  assert.equal(after.world.tavern.length, 2);
  assert.equal(after.world.discard.length, 1);
  assert.deepEqual(
    [...after.world.tavern, ...after.world.discard].map((card) => card.id).toSorted(),
    discard.map((card) => card.id).toSorted(),
  );
  assert.equal(after.world.battle.damageDealt, 2);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [heart, spade] }]);
  assert.deepEqual(after.decision, { kind: 'await-damage-discard', requiredDamage: 8 });
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('a repeated suit activates only once for a pair', () => {
  const club = animal('clubs');
  const four = makeCard(4, 'clubs');
  const ten = makeCard(10, 'diamonds');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [club, four, ten] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [club.id, four.id],
  });
  assert.equal(after.world.battle.damageDealt, 10);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [club, four] }]);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('Hearts replenish the Tavern before Diamonds draw, using total attack value', () => {
  const heart = animal('hearts');
  const diamond = makeCard(3, 'diamonds');
  const ten = makeCard(10, 'clubs');
  const top = makeCard(5, 'spades');
  const discard = [
    makeCard(2, 'clubs'),
    makeCard(3, 'clubs'),
    makeCard(4, 'clubs'),
    makeCard(6, 'clubs'),
  ];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [heart, diamond, ten] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    tavern: [top],
    discard,
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [diamond.id, heart.id],
  });
  assert.equal(handOf(after, 'alice').length, 5);
  assert.deepEqual(handOf(after, 'alice').slice(0, 2), [ten, top]);
  assert.equal(after.world.tavern.length, 1);
  assert.equal(after.world.discard.length, 0);
  assert.deepEqual(
    [...handOf(after, 'alice').slice(2), ...after.world.tavern].map((card) => card.id).toSorted(),
    discard.map((card) => card.id).toSorted(),
  );
  assert.equal(after.world.battle.damageDealt, 4);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [diamond, heart] }]);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('enemy immunity blocks only matching suit powers in a pair', () => {
  const club = animal('clubs');
  const diamond = makeCard(3, 'diamonds');
  const ten = makeCard(10, 'hearts');
  const drawn = makeCard(2, 'spades');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [club, diamond, ten] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'clubs'),
    tavern: [drawn],
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [club.id, diamond.id],
  });
  assert.deepEqual(handOf(after, 'alice'), [ten, drawn]);
  assert.equal(after.world.battle.damageDealt, 4);
  assert.deepEqual(after.world.battle.plays, [{ kind: 'attack', cards: [club, diamond] }]);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('a paired Spade shields by total attack value on subsequent turns, including after Jester cancels immunity', () => {
  const spade = animal('spades');
  const four = makeCard(4, 'hearts');
  const jester = { kind: 'jester', id: 'jester-1' } as const;
  const ten = makeCard(10, 'diamonds');
  const two = makeCard(2, 'diamonds');
  const six = makeCard(6, 'clubs');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [spade, four, ten, jester, two, six] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
  });
  const afterPair = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [spade.id, four.id],
  });
  assert.deepEqual(afterPair.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  const afterDiscard = transitionWithoutMutation(afterPair, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [ten.id],
  });
  const afterJester = transitionWithoutMutation(afterDiscard, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jester.id],
  });
  const afterChoice = transitionWithoutMutation(afterJester, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'alice',
  });
  const afterNextPlay = transitionWithoutMutation(afterChoice, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [two.id],
  });
  assert.deepEqual(afterNextPlay.world.battle.plays, [
    { kind: 'attack', cards: [spade, four] },
    { kind: 'jester', card: jester },
    { kind: 'attack', cards: [two] },
  ]);
  assert.equal(afterNextPlay.world.battle.damageDealt, 7);
  assert.deepEqual(afterNextPlay.decision, { kind: 'await-damage-discard', requiredDamage: 5 });
  assertCardsInExactlyOneZone(afterNextPlay, allCardIds(initial));
});

void test('unsupported pairs and plays of more than two cards are rejected', () => {
  const heart = animal('hearts');
  const club = animal('clubs');
  const two = makeCard(2, 'diamonds');
  const three = makeCard(3, 'spades');
  const jester = { kind: 'jester', id: 'jester-1' } as const;
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [heart, club, two, three, jester] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'diamonds'),
  });
  for (const cardIds of [
    [heart.id, jester.id],
    [jester.id, heart.id],
    [two.id, three.id],
    [heart.id, club.id, two.id],
  ]) {
    assertRejectedWithoutMutation(initial, { kind: 'play-cards', playerId: 'alice', cardIds });
  }
});
