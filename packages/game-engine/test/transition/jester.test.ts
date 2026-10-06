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

void test('a Jester played alone cancels immunity without damage or retaliation, then its player chooses anyone', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const earlierClubs = makeCard(3, 'clubs');
  const fiveHearts = makeCard(5, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [jester] },
      { id: 'bob', hand: [fiveHearts] },
      { id: 'carol', hand: [] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('king', 'clubs'),
    plays: [{ kind: 'attack', cards: [earlierClubs] }],
    damageDealt: 3,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jester.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), []);
  assert.deepEqual(afterPlay.world.battle.plays, [
    { kind: 'attack', cards: [earlierClubs] },
    { kind: 'jester', card: jester },
  ]);
  assert.equal(afterPlay.world.battle.immunityCancelled, true);
  assert.equal(afterPlay.world.battle.damageDealt, 3); // The Jester's attack value is 0.
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-next-player-choice' });
  assertCardsInExactlyOneZone(afterPlay, originalIds);

  const afterChoice = transitionWithBattle(afterPlay, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'carol',
  });
  assert.equal(afterChoice.world.currentPlayer, 'carol');
  assert.deepEqual(afterChoice.decision, { kind: 'await-turn-action' });
  assert.deepEqual(afterChoice.world.battle, afterPlay.world.battle);
  assertCardsInExactlyOneZone(afterChoice, originalIds);

  const chooseSelf = transitionWithBattle(afterPlay, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'alice',
  });
  assert.equal(chooseSelf.world.currentPlayer, 'alice');
  assert.deepEqual(chooseSelf.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(chooseSelf, originalIds);
});

void test('only the Jester player can choose a valid next player, and other actions are blocked meanwhile', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const twoHearts = makeCard(2, 'hearts');
  const choice = transitionWithBattle(
    makeGameState({
      players: [
        { id: 'alice', hand: [jester, twoHearts] },
        { id: 'bob', hand: [] },
      ],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'hearts'),
    }),
    { kind: 'play-cards', playerId: 'alice', cardIds: [jester.id] },
  );

  assertRejectedWithoutMutation(choice, {
    kind: 'choose-next-player',
    playerId: 'bob',
    targetPlayerId: 'bob',
  });
  assertRejectedWithoutMutation(choice, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'missing',
  });
  assertRejectedWithoutMutation(choice, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [twoHearts.id],
  });
  assertRejectedWithoutMutation(choice, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [twoHearts.id],
  });
});

void test('a Jester cannot be combined with another card in either order', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const twoHearts = makeCard(2, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [jester, twoHearts] }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
  });

  for (const cardIds of [
    [jester.id, twoHearts.id],
    [twoHearts.id, jester.id],
  ]) {
    assertRejectedWithoutMutation(initial, { kind: 'play-cards', playerId: 'alice', cardIds });
  }
});

void test('previously immune Spades shield the next turn after a Jester cancels immunity', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const earlierSpades = makeCard(4, 'spades');
  const twoClubs = makeCard(2, 'clubs');
  const tenHearts = makeCard(10, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [jester] },
      { id: 'bob', hand: [twoClubs, tenHearts] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'spades'),
    damageDealt: 4,
    plays: [{ kind: 'attack', cards: [earlierSpades] }],
  });
  const originalIds = allCardIds(initial);

  const afterJester = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jester.id],
  });
  const afterChoice = transitionWithBattle(afterJester, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'bob',
  });
  const afterBobPlay = transitionWithBattle(afterChoice, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [twoClubs.id],
  });

  assert.deepEqual(afterBobPlay.world.battle.plays, [
    { kind: 'attack', cards: [earlierSpades] },
    { kind: 'jester', card: jester },
    { kind: 'attack', cards: [twoClubs] },
  ]);
  assert.equal(afterBobPlay.world.battle.damageDealt, 8);
  assert.deepEqual(afterBobPlay.decision, { kind: 'await-damage-discard', requiredDamage: 6 });
  assertCardsInExactlyOneZone(afterBobPlay, originalIds);
});

void test('previously immune Clubs damage is not recalculated after a Jester', () => {
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const earlierClubs = makeCard(3, 'clubs');
  const twoHearts = makeCard(2, 'hearts');
  const tenDiamonds = makeCard(10, 'diamonds');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [jester] },
      { id: 'bob', hand: [twoHearts, tenDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'clubs'),
    damageDealt: 3,
    plays: [{ kind: 'attack', cards: [earlierClubs] }],
  });
  const originalIds = allCardIds(initial);

  const afterJester = transitionWithBattle(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [jester.id],
  });
  const afterChoice = transitionWithBattle(afterJester, {
    kind: 'choose-next-player',
    playerId: 'alice',
    targetPlayerId: 'bob',
  });
  const afterBobPlay = transitionWithBattle(afterChoice, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [twoHearts.id],
  });

  assert.deepEqual(afterBobPlay.world.battle.plays, [
    { kind: 'attack', cards: [earlierClubs] },
    { kind: 'jester', card: jester },
    { kind: 'attack', cards: [twoHearts] },
  ]);
  assert.equal(afterBobPlay.world.battle.damageDealt, 5);
  assert.deepEqual(afterBobPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterBobPlay, originalIds);
});
