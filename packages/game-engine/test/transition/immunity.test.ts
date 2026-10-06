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

for (const jesterPlayed of [false, true]) {
  void test(`Clubs against Jack of Clubs ${jesterPlayed ? 'double damage after immunity is cancelled' : 'deal normal damage while immune'}`, () => {
    const fiveClubs = makeCard(5, 'clubs');
    const earlierClubs = makeCard(2, 'clubs');
    const tenHearts = makeCard(10, 'hearts');
    const jester = { kind: 'jester', id: 'jester-one' } as const;
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [fiveClubs, tenHearts] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'clubs'),
      plays: [
        { kind: 'attack', cards: [earlierClubs] },
        ...(jesterPlayed ? [{ kind: 'jester', card: jester } as const] : []),
      ],
      damageDealt: 2,
    });
    const originalIds = allCardIds(initial);

    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [fiveClubs.id],
    });

    assert.deepEqual(afterPlay.world.battle.plays, [
      { kind: 'attack', cards: [earlierClubs] },
      ...(jesterPlayed ? [{ kind: 'jester', card: jester }] : []),
      { kind: 'attack', cards: [fiveClubs] },
    ]);
    // Earlier Clubs damage is never recalculated when immunity is cancelled.
    assert.equal(afterPlay.world.battle.damageDealt, jesterPlayed ? 12 : 7);
    assert.deepEqual(handOf(afterPlay, 'alice'), [tenHearts]);
    assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
    assertCardsInExactlyOneZone(afterPlay, originalIds);
  });

  void test(`Diamonds against Jack of Diamonds ${jesterPlayed ? 'draw after immunity is cancelled' : 'do not draw while immune'}`, () => {
    const fourDiamonds = makeCard(4, 'diamonds');
    const tenHearts = makeCard(10, 'hearts');
    const twoHearts = makeCard(2, 'hearts');
    const threeHearts = makeCard(3, 'hearts');
    const jester = { kind: 'jester', id: 'jester-one' } as const;
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [fourDiamonds, tenHearts] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'diamonds'),
      plays: jesterPlayed ? [{ kind: 'jester', card: jester }] : [],
      tavern: [twoHearts, threeHearts],
    });
    const originalIds = allCardIds(initial);

    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [fourDiamonds.id],
    });

    assert.deepEqual(
      handOf(afterPlay, 'alice'),
      jesterPlayed ? [tenHearts, twoHearts, threeHearts] : [tenHearts],
    );
    assert.deepEqual(afterPlay.world.tavern, jesterPlayed ? [] : [twoHearts, threeHearts]);
    assert.deepEqual(afterPlay.world.battle.plays, [
      ...(jesterPlayed ? [{ kind: 'jester', card: jester }] : []),
      { kind: 'attack', cards: [fourDiamonds] },
    ]);
    assert.equal(afterPlay.world.battle.damageDealt, 4);
    assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 10 });
    assertCardsInExactlyOneZone(afterPlay, originalIds);
  });

  void test(`Spades against Jack of Spades ${jesterPlayed ? 'shield including earlier plays after immunity is cancelled' : 'do not shield while immune'}`, () => {
    const earlierSpades = makeCard(4, 'spades');
    const threeSpades = makeCard(3, 'spades');
    const tenHearts = makeCard(10, 'hearts');
    const jester = { kind: 'jester', id: 'jester-one' } as const;
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [threeSpades, tenHearts] }],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'spades'),
      plays: [
        { kind: 'attack', cards: [earlierSpades] },
        ...(jesterPlayed ? [{ kind: 'jester', card: jester } as const] : []),
      ],
      damageDealt: 4,
    });
    const originalIds = allCardIds(initial);

    const afterPlay = transitionWithBattle(initial, {
      kind: 'play-cards',
      playerId: 'alice',
      cardIds: [threeSpades.id],
    });

    assert.deepEqual(afterPlay.world.battle.plays, [
      { kind: 'attack', cards: [earlierSpades] },
      ...(jesterPlayed ? [{ kind: 'jester', card: jester }] : []),
      { kind: 'attack', cards: [threeSpades] },
    ]);
    assert.equal(afterPlay.world.battle.damageDealt, 7);
    assert.deepEqual(handOf(afterPlay, 'alice'), [tenHearts]);
    assert.deepEqual(afterPlay.decision, {
      kind: 'await-retaliation-action',
      requiredDamage: jesterPlayed ? 3 : 10,
    });
    assertCardsInExactlyOneZone(afterPlay, originalIds);
  });
}

void test('non-matching Clubs and previously played Spades keep their powers against Queen of Diamonds', () => {
  const fourSpades = makeCard(4, 'spades');
  const fiveClubs = makeCard(5, 'clubs');
  const tenHearts = makeCard(10, 'hearts');
  const twoHearts = makeCard(2, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [fiveClubs, tenHearts, twoHearts] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('queen', 'diamonds'),
    plays: [{ kind: 'attack', cards: [fourSpades] }],
    damageDealt: 4,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fiveClubs.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [tenHearts, twoHearts]);
  assert.deepEqual(afterPlay.world.battle.plays, [
    { kind: 'attack', cards: [fourSpades] },
    { kind: 'attack', cards: [fiveClubs] },
  ]);
  assert.equal(afterPlay.world.battle.damageDealt, 14);
  assert.deepEqual(afterPlay.decision, { kind: 'await-retaliation-action', requiredDamage: 11 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
