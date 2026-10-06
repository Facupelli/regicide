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

for (const { rank, attack, health, nextRank } of [
  { rank: 'jack', attack: 10, health: 20, nextRank: 'queen' },
  { rank: 'queen', attack: 15, health: 30, nextRank: 'king' },
  { rank: 'king', attack: 20, health: 40, nextRank: 'king' },
] as const) {
  void test(`${rank} attacks for ${attack} and is defeated at ${health} health`, () => {
    const enemy = makeRoyal(rank, 'hearts');
    const twoDiamonds = makeCard(2, 'diamonds');
    const animalSpades = { kind: 'animal', id: 'animal-spades', suit: 'spades' } as const;
    const reserve = [makeCard(10, 'clubs'), makeCard(10, 'spades')];
    const nextEnemy = makeRoyal(nextRank, 'diamonds');
    const followingEnemy = makeRoyal('king', 'clubs');
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [twoDiamonds, animalSpades, ...reserve] }],
      currentPlayer: 'alice',
      enemy,
      damageDealt: health - 3,
      castle: [nextEnemy, followingEnemy],
    });
    const originalIds = allCardIds(initial);
    const afterAttack = transitionWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [twoDiamonds.id],
    });
    assert.equal(afterAttack.world.battle.damageDealt, health - 1);
    assert.deepEqual(afterAttack.decision, {
      kind: 'await-damage-discard',
      requiredDamage: attack,
    });
    assertCardsInExactlyOneZone(afterAttack, originalIds);

    const afterDiscard = transitionWithoutMutation(afterAttack, {
      kind: 'discard-for-damage',
      playerId: 'alice',
      cardIds: reserve.map((card) => card.id),
    });
    const afterDefeat = transitionWithoutMutation(afterDiscard, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [animalSpades.id],
    });
    assert.deepEqual(afterDefeat.world.tavern, [enemy]);
    assert.deepEqual(afterDefeat.world.battle.enemy, nextEnemy);
    assert.deepEqual(afterDefeat.world.castle, [followingEnemy]);
    assertCardsInExactlyOneZone(afterDefeat, originalIds);
  });
}

for (const [rank, nextRank, attack, health] of [
  ['jack', 'queen', 15, 20],
  ['queen', 'king', 20, 30],
] as const) {
  void test(`defeating a ${rank} reveals a ${nextRank} and the same player can continue`, () => {
    const enemy = makeRoyal(rank, 'diamonds');
    const nextEnemy = makeRoyal(nextRank, 'diamonds');
    const followingEnemy = makeRoyal('king', 'spades');
    const twoDiamonds = makeCard(2, 'diamonds');
    const threeDiamonds = makeCard(3, 'diamonds');
    const reserve = [makeCard(10, 'hearts'), makeCard(10, 'clubs')];
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [twoDiamonds, threeDiamonds, ...reserve] }],
      currentPlayer: 'alice',
      enemy,
      damageDealt: health - 2,
      castle: [nextEnemy, followingEnemy],
    });
    const originalIds = allCardIds(initial);
    const afterDefeat = transitionWithoutMutation(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [twoDiamonds.id],
    });
    assert.deepEqual(afterDefeat.world.battle.enemy, nextEnemy);
    assert.deepEqual(afterDefeat.world.castle, [followingEnemy]);
    assert.equal(afterDefeat.world.currentPlayer, 'alice');
    assert.deepEqual(afterDefeat.decision, { kind: 'await-turn-action' });
    assertCardsInExactlyOneZone(afterDefeat, originalIds);

    const afterNextPlay = transitionWithoutMutation(afterDefeat, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [threeDiamonds.id],
    });
    assert.deepEqual(afterNextPlay.world.battle.enemy, nextEnemy);
    assert.equal(afterNextPlay.world.battle.damageDealt, 3);
    assert.deepEqual(afterNextPlay.decision, {
      kind: 'await-damage-discard',
      requiredDamage: attack,
    });
    assert.deepEqual(afterNextPlay.world.castle, [followingEnemy]);
    assertCardsInExactlyOneZone(afterNextPlay, originalIds);
  });
}

void test('overkill King defeat discards the enemy, cleans up plays, and reveals the next enemy', () => {
  const eightClubs = makeCard(8, 'clubs');
  const threeClubs = makeCard(3, 'clubs');
  const sixDiamonds = makeCard(6, 'diamonds');
  const threeDiamonds = makeCard(3, 'diamonds');
  const enemy = makeRoyal('king', 'hearts');
  const nextEnemy = makeRoyal('king', 'diamonds');
  const followingEnemy = makeRoyal('king', 'spades');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [threeClubs, sixDiamonds] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy,
    damageDealt: 36,
    plays: [{ kind: 'attack', cards: [eightClubs] }],
    immunityCancelled: true,
    castle: [nextEnemy, followingEnemy],
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
  assert.deepEqual(afterPlay.world.discard, [enemy, eightClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.tavern, []);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: nextEnemy,
    damageDealt: 0,
    plays: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [followingEnemy]);
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

void test('exact Queen defeat puts the enemy on Tavern top, cleans up plays, and reveals the next enemy', () => {
  const sevenClubs = makeCard(7, 'clubs');
  const threeClubs = makeCard(3, 'clubs');
  const fiveClubs = makeCard(5, 'clubs');
  const threeDiamonds = makeCard(3, 'diamonds');
  const twoHearts = makeCard(2, 'hearts');
  const sixDiamonds = makeCard(6, 'diamonds');
  const enemy = makeRoyal('queen', 'hearts');
  const nextEnemy = makeRoyal('king', 'diamonds');
  const followingEnemy = makeRoyal('king', 'spades');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [threeClubs, fiveClubs] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy,
    damageDealt: 24,
    plays: [{ kind: 'attack', cards: [sevenClubs] }],
    immunityCancelled: true,
    tavern: [twoHearts, sixDiamonds],
    castle: [nextEnemy, followingEnemy],
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
  assert.deepEqual(afterPlay.world.tavern, [enemy, twoHearts, sixDiamonds]);
  assert.deepEqual(afterPlay.world.discard, [sevenClubs, threeClubs]);
  assert.deepEqual(afterPlay.world.battle, {
    enemy: nextEnemy,
    damageDealt: 0,
    plays: [],
    immunityCancelled: false,
  });
  assert.deepEqual(afterPlay.world.castle, [followingEnemy]);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
