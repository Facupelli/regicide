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

void test('exact defeat of the final King wins and puts the King on Tavern top after cleanup', () => {
  const king = makeRoyal('king', 'clubs');
  const earlierPlay = makeCard(8, 'hearts');
  const finalPlay = makeCard(2, 'spades');
  const tavernCard = makeCard(4, 'diamonds');
  const oldDiscard = makeCard(5, 'hearts');
  const bobCard = makeCard(3, 'clubs');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [finalPlay] },
      { id: 'bob', hand: [bobCard] },
    ],
    currentPlayer: 'alice',
    enemy: king,
    damageDealt: 38,
    plays: [{ kind: 'attack', cards: [earlierPlay] }],
    tavern: [tavernCard],
    discard: [oldDiscard],
    castle: [],
  });
  const originalIds = allCardIds(initial);
  const won = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [finalPlay.id],
  });

  assert.equal(won.kind, 'game-over');
  assert.equal(won.result, 'win');
  assert.equal(won.decision, undefined);
  assert.equal(won.world.currentPlayer, 'alice');
  assert.equal('battle' in won.world, false);
  assert.deepEqual(won.world.castle, []);
  assert.deepEqual(won.world.tavern, [king, tavernCard]);
  assert.deepEqual(won.world.discard, [oldDiscard, earlierPlay, finalPlay]);
  assert.deepEqual(handOf(won, 'alice'), []);
  assert.deepEqual(handOf(won, 'bob'), [bobCard]);
  assertCardsInExactlyOneZone(won, originalIds);
  assertRejectedWithoutMutation(won, { kind: 'yield', playerId: 'alice' });
  assertRejectedWithoutMutation(won, {
    kind: 'play-cards',
    playerId: 'bob',
    cardIds: [bobCard.id],
  });
});

void test('overkill defeat of the final King wins and discards the King and all played cards', () => {
  const king = makeRoyal('king', 'hearts');
  const earlierPlay = makeCard(8, 'spades');
  const jester = { kind: 'jester', id: 'jester-one' } as const;
  const finalPlay = makeCard(2, 'clubs');
  const oldDiscard = makeCard(5, 'diamonds');
  const tavernCard = makeCard(4, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [finalPlay] }],
    currentPlayer: 'alice',
    enemy: king,
    damageDealt: 39,
    plays: [
      { kind: 'attack', cards: [earlierPlay] },
      { kind: 'jester', card: jester },
    ],
    tavern: [tavernCard],
    discard: [oldDiscard],
    castle: [],
  });
  const originalIds = allCardIds(initial);
  const won = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [finalPlay.id],
  });

  assert.equal(won.kind, 'game-over');
  assert.equal(won.result, 'win');
  assert.equal(won.decision, undefined);
  assert.equal(won.world.currentPlayer, 'alice');
  assert.equal('battle' in won.world, false);
  assert.deepEqual(won.world.castle, []);
  assert.deepEqual(won.world.tavern, [tavernCard]);
  assert.deepEqual(won.world.discard, [oldDiscard, king, earlierPlay, jester, finalPlay]);
  assert.deepEqual(handOf(won, 'alice'), []);
  assertCardsInExactlyOneZone(won, originalIds);
  assertRejectedWithoutMutation(won, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [finalPlay.id],
  });
});

for (const rank of ['jack', 'queen'] as const) {
  void test(`an empty Castle after defeating a ${rank} is not a win`, () => {
    const enemy = makeRoyal(rank, 'clubs');
    const finalPlay = makeCard(2, 'spades');
    const initial = makeGameState({
      players: [{ id: 'alice', hand: [finalPlay] }],
      currentPlayer: 'alice',
      enemy,
      damageDealt: rank === 'jack' ? 18 : 28,
      castle: [],
    });
    const before = structuredClone(initial);
    assert.throws(
      () =>
        transitionWithoutMutation(initial, {
          kind: 'play-cards',
          playerId: 'alice',
          cardIds: [finalPlay.id],
        }),
      /Unsupported game outcome/,
    );
    assert.deepEqual(initial, before);
  });
}
