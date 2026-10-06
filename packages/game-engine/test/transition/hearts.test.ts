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

void test('Hearts shuffle discard, heal attack value onto the bottom of Tavern, and still deal damage', () => {
  const twoHearts = makeCard(2, 'hearts');
  const tenClubs = makeCard(10, 'clubs');
  const top = makeCard(3, 'diamonds');
  const bottom = makeCard(4, 'diamonds');
  const [a, b, c, d, e] = [
    makeCard(2, 'clubs'),
    makeCard(3, 'clubs'),
    makeCard(4, 'clubs'),
    makeCard(5, 'clubs'),
    makeCard(6, 'clubs'),
  ];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [twoHearts, tenClubs] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    tavern: [top, bottom],
    discard: [a, b, c, d, e],
    rngState: 1,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoHearts.id],
  });

  assert.deepEqual(afterPlay.world.tavern.slice(0, 2), [top, bottom]);
  assert.equal(afterPlay.world.tavern.length, 4);
  assert.equal(afterPlay.world.discard.length, 3);
  assert.deepEqual(
    [...afterPlay.world.tavern.slice(2), ...afterPlay.world.discard]
      .map((card) => card.id)
      .toSorted(),
    [a, b, c, d, e].map((card) => card.id).toSorted(),
  );
  assert.notEqual(afterPlay.world.rngState, initial.world.rngState);
  assert.deepEqual(handOf(afterPlay, 'alice'), [tenClubs]);
  assert.deepEqual(afterPlay.world.battle.plays, [{ kind: 'attack', cards: [twoHearts] }]);
  assert.equal(afterPlay.world.battle.damageDealt, 2);
  assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Hearts heal all available cards if discard is smaller than attack value', () => {
  const sixHearts = makeCard(6, 'hearts');
  const tenClubs = makeCard(10, 'clubs');
  const top = makeCard(2, 'diamonds');
  const first = makeCard(3, 'clubs');
  const second = makeCard(4, 'clubs');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [sixHearts, tenClubs] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    tavern: [top],
    discard: [first, second],
    rngState: 1,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [sixHearts.id],
  });

  assert.deepEqual(afterPlay.world.tavern.slice(0, 1), [top]);
  assert.deepEqual(
    afterPlay.world.tavern
      .slice(1)
      .map((card) => card.id)
      .toSorted(),
    [first.id, second.id].toSorted(),
  );
  assert.deepEqual(afterPlay.world.discard, []);
  assert.deepEqual(afterPlay.world.battle.plays, [{ kind: 'attack', cards: [sixHearts] }]);
  assert.equal(afterPlay.world.battle.damageDealt, 6);
  assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Hearts with empty discard still deals damage to a Queen without advancing RNG', () => {
  const twoHearts = makeCard(2, 'hearts');
  const tenClubs = makeCard(10, 'clubs');
  const sixSpades = makeCard(6, 'spades');
  const top = makeCard(3, 'diamonds');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [twoHearts, tenClubs, sixSpades] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('queen', 'spades'),
    tavern: [top],
    rngState: 1,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoHearts.id],
  });

  assert.deepEqual(afterPlay.world.tavern, [top]);
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.rngState, 1);
  assert.deepEqual(afterPlay.world.battle.plays, [{ kind: 'attack', cards: [twoHearts] }]);
  assert.equal(afterPlay.world.battle.damageDealt, 2);
  assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 15 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('same state and Hearts action always produce the same shuffle and result', () => {
  const twoHearts = makeCard(2, 'hearts');
  const tenClubs = makeCard(10, 'clubs');
  const discard = [
    makeCard(2, 'clubs'),
    makeCard(3, 'clubs'),
    makeCard(4, 'clubs'),
    makeCard(5, 'clubs'),
    makeCard(6, 'clubs'),
  ];
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [twoHearts, tenClubs] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    discard,
    rngState: 42,
  });
  const originalIds = allCardIds(initial);
  const action = { kind: 'play-cards', playerId: 'alice', cardIds: [twoHearts.id] } as const;

  const first = transitionWithBattle(initial, action);
  const second = transitionWithBattle(initial, action);

  assert.deepEqual(first, second);
  assert.equal(first.world.tavern.length, 2);
  assert.equal(first.world.discard.length, 3);
  assertCardsInExactlyOneZone(first, originalIds);
});

void test('different seeds can shuffle discard and heal different cards', () => {
  const twoHearts = makeCard(2, 'hearts');
  const tenClubs = makeCard(10, 'clubs');
  const discard = [
    makeCard(2, 'clubs'),
    makeCard(3, 'clubs'),
    makeCard(4, 'clubs'),
    makeCard(5, 'clubs'),
    makeCard(6, 'clubs'),
  ];
  const shuffledOrders = new Set<string>();
  const healedCardSets = new Set<string>();

  for (const rngState of [1, 2, 3, 4, 5, 42, 99, 2024]) {
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [twoHearts, tenClubs] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'spades'),
      discard,
      rngState,
    });
    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [twoHearts.id],
    });
    shuffledOrders.add(
      [...afterPlay.world.tavern, ...afterPlay.world.discard].map((card) => card.id).join(','),
    );
    healedCardSets.add(
      afterPlay.world.tavern
        .map((card) => card.id)
        .toSorted()
        .join(','),
    );
    assertCardsInExactlyOneZone(afterPlay, allCardIds(initial));
  }

  assert.ok(shuffledOrders.size > 1);
  assert.ok(healedCardSets.size > 1);
  assert.ok(
    [...shuffledOrders].some((order) => order !== discard.map((card) => card.id).join(',')),
  );
});

for (const jesterPlayed of [false, true]) {
  void test(`Hearts against Jack of Hearts ${jesterPlayed ? 'heal after immunity is cancelled' : 'do not heal while immune'} but still deal damage`, () => {
    const twoHearts = makeCard(2, 'hearts');
    const tenClubs = makeCard(10, 'clubs');
    const top = makeCard(3, 'diamonds');
    const discarded = makeCard(4, 'clubs');
    const jester = { kind: 'jester', id: 'jester-one' } as const;
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [twoHearts, tenClubs] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'hearts'),
      plays: jesterPlayed ? [{ kind: 'jester', card: jester }] : [],
      tavern: [top],
      discard: [discarded],
      rngState: 1,
    });
    const originalIds = allCardIds(initial);

    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [twoHearts.id],
    });

    assert.deepEqual(afterPlay.world.tavern, jesterPlayed ? [top, discarded] : [top]);
    assert.deepEqual(afterPlay.world.discard, jesterPlayed ? [] : [discarded]);
    assert.equal(afterPlay.world.rngState, 1);
    assert.deepEqual(afterPlay.world.battle.plays, [
      ...(jesterPlayed ? [{ kind: 'jester', card: jester } as const] : []),
      { kind: 'attack', cards: [twoHearts] },
    ]);
    assert.equal(afterPlay.world.battle.damageDealt, 2);
    assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
    assertCardsInExactlyOneZone(afterPlay, originalIds);
  });
}

for (const defeatKind of ['exact', 'overkill'] as const) {
  void test(`Hearts heals before ${defeatKind} enemy defeat cleanup`, () => {
    const threeHearts = makeCard(3, 'hearts');
    const earlierPlay = makeCard(2, 'spades');
    const top = makeCard(3, 'diamonds');
    const first = makeCard(4, 'clubs');
    const second = makeCard(5, 'clubs');
    const enemy = makeRoyal('jack', 'diamonds');
    const nextEnemy = makeRoyal('jack', 'clubs');
    const followingEnemy = makeRoyal('queen', 'spades');
    const initial = makeGameState({
      players: [
        { id: 'alice', hand: [threeHearts] },
        { id: 'bob', hand: [makeCard(6, 'spades')] },
      ],
      currentPlayer: 'alice',
      enemy,
      damageDealt: defeatKind === 'exact' ? 17 : 18,
      plays: [{ kind: 'attack', cards: [earlierPlay] }],
      tavern: [top],
      discard: [first, second],
      castle: [nextEnemy, followingEnemy],
      rngState: 1,
    });
    const originalIds = allCardIds(initial);

    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [threeHearts.id],
    });

    assert.deepEqual(afterPlay.world.tavern.slice(0, defeatKind === 'exact' ? 2 : 1), [
      ...(defeatKind === 'exact' ? [enemy] : []),
      top,
    ]);
    assert.deepEqual(
      afterPlay.world.tavern
        .slice(defeatKind === 'exact' ? 2 : 1)
        .map((card) => card.id)
        .toSorted(),
      [first.id, second.id].toSorted(),
    );
    assert.deepEqual(afterPlay.world.discard, [
      ...(defeatKind === 'overkill' ? [enemy] : []),
      earlierPlay,
      threeHearts,
    ]);
    assert.deepEqual(afterPlay.world.battle, {
      enemy: nextEnemy,
      damageDealt: 0,
      plays: [],
    });
    assert.deepEqual(afterPlay.world.castle, [followingEnemy]);
    assert.equal(afterPlay.world.currentPlayer, 'alice');
    assert.deepEqual(afterPlay.decision, { kind: 'await-turn-action' });
    assertCardsInExactlyOneZone(afterPlay, originalIds);
  });
}
