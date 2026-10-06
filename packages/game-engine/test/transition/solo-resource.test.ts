import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupGame } from '../../src/index.ts';
import {
  allCardIds,
  assertCardsInExactlyOneZone,
  transitionWithoutMutation,
} from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('solo setup starts with two Jester uses available and no Jesters in card zones', () => {
  const state = setupGame({ playerIds: ['alice'], rngState: 42 });
  assert.equal(state.kind, 'active');
  assert.equal(state.world.soloJestersUsed, 0);
  assert.equal(state.world.players[0]?.hand.length, 8);
  assert.equal(state.world.tavern.length, 32);
  assert.equal(allCardIds(state).filter((id) => id.startsWith('jester-')).length, 0);
  assert.equal(allCardIds(state).length, 52);
  assertCardsInExactlyOneZone(state, allCardIds(state));
});

for (const [playerIds, expectedJesters, handSize] of [
  [['alice', 'bob'], 0, 7],
  [['alice', 'bob', 'carol'], 1, 6],
  [['alice', 'bob', 'carol', 'dave'], 2, 5],
] as const) {
  void test(`${playerIds.length}-player setup has no solo resource and retains its Tavern Jesters`, () => {
    const state = setupGame({ playerIds, rngState: 42 });
    assert.equal(state.kind, 'active');
    assert.equal(state.world.soloJestersUsed, null);
    assert.ok(state.world.players.every((player) => player.hand.length === handSize));
    assert.equal(
      allCardIds(state).filter((id) => id.startsWith('jester-')).length,
      expectedJesters,
    );
    assert.equal(allCardIds(state).length, 52 + expectedJesters);
    assertCardsInExactlyOneZone(state, allCardIds(state));
  });
}

void test('a transition preserves the solo Jester consumption count', () => {
  const attack = makeCard(2, 'spades');
  const reserve = makeCard(10, 'clubs');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [attack, reserve] }],
    currentPlayer: 'alice',
    soloJestersUsed: 1,
    enemy: makeRoyal('jack', 'hearts'),
  });
  const after = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [attack.id],
  });

  assert.equal(after.kind, 'active');
  assert.equal(after.world.soloJestersUsed, 1);
  assertCardsInExactlyOneZone(after, allCardIds(initial));
});

void test('victory preserves solo Jester consumption in the resolved world', () => {
  const finalPlay = makeCard(2, 'spades');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: [finalPlay] }],
    currentPlayer: 'alice',
    soloJestersUsed: 2,
    enemy: makeRoyal('king', 'hearts'),
    damageDealt: 38,
  });
  const won = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [finalPlay.id],
  });

  assert.equal(won.kind, 'game-over');
  assert.equal(won.result, 'win');
  assert.equal(won.world.soloJestersUsed, 2);
  assert.equal('battle' in won.world, false);
  assertCardsInExactlyOneZone(won, allCardIds(initial));
});
