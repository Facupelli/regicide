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

void test('a Clubs attack resolves through retaliation, then discarding passes the turn to Bob', () => {
  const fiveClubs = makeCard(5, 'clubs');
  const sixDiamonds = makeCard(6, 'diamonds');
  const fourSpades = makeCard(4, 'spades');
  const twoHearts = makeCard(2, 'hearts');
  const threeDiamonds = makeCard(3, 'diamonds');
  const jackHearts = makeRoyal('jack', 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [fiveClubs, sixDiamonds, fourSpades, twoHearts] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: jackHearts,
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [fiveClubs.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [sixDiamonds, fourSpades, twoHearts]);
  assert.deepEqual(afterPlay.world.battle.playedCards, [fiveClubs]);
  assert.deepEqual(afterPlay.world.battle.enemy, jackHearts);
  assert.equal(afterPlay.world.battle.damageDealt, 10);
  assert.deepEqual(afterPlay.world.discard, []);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, {
    kind: 'await-damage-discard',
    requiredDamage: 10,
  });
  assertCardsInExactlyOneZone(afterPlay, originalIds);

  const afterDiscard = transitionWithoutMutation(afterPlay, {
    kind: 'discard-for-damage',
    playerId: 'alice',
    cardIds: [sixDiamonds.id, fourSpades.id],
  });

  assert.deepEqual(handOf(afterDiscard, 'alice'), [twoHearts]);
  assert.deepEqual(handOf(afterDiscard, 'bob'), [threeDiamonds]);
  assert.deepEqual(afterDiscard.world.discard, [sixDiamonds, fourSpades]);
  assert.deepEqual(afterDiscard.world.battle.playedCards, [fiveClubs]);
  assert.deepEqual(afterDiscard.world.battle.enemy, jackHearts);
  assert.equal(afterDiscard.world.battle.damageDealt, 10);
  assert.equal(afterDiscard.world.currentPlayer, 'bob');
  assert.deepEqual(afterDiscard.decision, { kind: 'await-turn-action' });
  assertCardsInExactlyOneZone(afterDiscard, originalIds);
});
