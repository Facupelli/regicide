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

void test('Diamonds draw attack value clockwise before damage and retaliation, skipping full players', () => {
  const cards = {
    fourDiamonds: makeCard(4, 'diamonds'),
    twoClubs: makeCard(2, 'clubs'),
    twoDiamonds: makeCard(2, 'diamonds'),
    threeClubs: makeCard(3, 'clubs'),
    fourClubs: makeCard(4, 'clubs'),
    fourHearts: makeCard(4, 'hearts'),
    fourSpades: makeCard(4, 'spades'),
    fiveClubs: makeCard(5, 'clubs'),
    fiveDiamonds: makeCard(5, 'diamonds'),
    fiveSpades: makeCard(5, 'spades'),
    sixClubs: makeCard(6, 'clubs'),
    sixDiamonds: makeCard(6, 'diamonds'),
    sixSpades: makeCard(6, 'spades'),
    sevenClubs: makeCard(7, 'clubs'),
    sevenHearts: makeCard(7, 'hearts'),
    sevenDiamonds: makeCard(7, 'diamonds'),
    eightClubs: makeCard(8, 'clubs'),
    eightDiamonds: makeCard(8, 'diamonds'),
    eightHearts: makeCard(8, 'hearts'),
    twoHearts: makeCard(2, 'hearts'),
  };
  const initial = makeGameState({
    players: [
      {
        id: 'alice',
        hand: [
          cards.fourDiamonds,
          cards.twoClubs,
          cards.twoDiamonds,
          cards.threeClubs,
          cards.twoHearts,
        ],
      },
      {
        id: 'bob',
        hand: [
          cards.fourClubs,
          cards.fourHearts,
          cards.fourSpades,
          cards.fiveClubs,
          cards.fiveDiamonds,
          cards.fiveSpades,
        ],
      },
      {
        id: 'carol',
        hand: [cards.sixClubs, cards.sixDiamonds, cards.sixSpades, cards.sevenClubs],
      },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    tavern: [
      cards.sevenHearts,
      cards.sevenDiamonds,
      cards.eightClubs,
      cards.eightDiamonds,
      cards.eightHearts,
    ],
  });
  const originalIds = allCardIds(initial);
  // Without her draws, Alice's remaining hand is worth only 9, less than retaliation's 10.
  assert.equal(
    initial.world.players[0]?.hand
      .slice(1)
      .reduce((total, card) => total + (card.kind === 'number' ? card.rank : 0), 0),
    9,
  );

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [cards.fourDiamonds.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [
    cards.twoClubs,
    cards.twoDiamonds,
    cards.threeClubs,
    cards.twoHearts,
    cards.sevenHearts,
    cards.eightClubs,
  ]);
  assert.deepEqual(handOf(afterPlay, 'bob'), initial.world.players[1]?.hand);
  assert.deepEqual(handOf(afterPlay, 'carol'), [
    cards.sixClubs,
    cards.sixDiamonds,
    cards.sixSpades,
    cards.sevenClubs,
    cards.sevenDiamonds,
    cards.eightDiamonds,
  ]);
  assert.deepEqual(afterPlay.world.tavern, [cards.eightHearts]);
  assert.deepEqual(afterPlay.world.battle.plays, [{ kind: 'attack', cards: [cards.fourDiamonds] }]);
  assert.equal(afterPlay.world.battle.damageDealt, 4);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Diamonds stop drawing when Tavern is exhausted and still deal damage and face retaliation', () => {
  const threeDiamonds = makeCard(3, 'diamonds');
  const fiveClubs = makeCard(5, 'clubs');
  const sixHearts = makeCard(6, 'hearts');
  const twoHearts = makeCard(2, 'hearts');
  const drawCard = makeCard(5, 'hearts');
  const initial = makeGameState({
    players: [
      { id: 'alice', hand: [threeDiamonds, fiveClubs, sixHearts] },
      { id: 'bob', hand: [twoHearts] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    tavern: [drawCard],
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeDiamonds.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [fiveClubs, sixHearts, drawCard]);
  assert.deepEqual(handOf(afterPlay, 'bob'), [twoHearts]);
  assert.deepEqual(afterPlay.world.tavern, []);
  assert.deepEqual(afterPlay.world.battle.plays, [{ kind: 'attack', cards: [threeDiamonds] }]);
  assert.equal(afterPlay.world.battle.damageDealt, 3);
  assert.equal(afterPlay.world.currentPlayer, 'alice');
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});

void test('Diamonds stop drawing when all players reach their hand limit', () => {
  // Use eight distinct cards in the solo hand.
  const threeDiamonds = makeCard(3, 'diamonds');
  const soloHand = [
    threeDiamonds,
    makeCard(5, 'clubs'),
    makeCard(6, 'diamonds'),
    makeCard(4, 'spades'),
    makeCard(2, 'hearts'),
    makeCard(3, 'clubs'),
    makeCard(7, 'hearts'),
    makeCard(8, 'hearts'),
  ];
  const drawCard = makeCard(9, 'hearts');
  const leftover = makeCard(10, 'hearts');
  const initial = makeGameState({
    players: [{ id: 'alice', hand: soloHand }],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
    tavern: [drawCard, leftover],
  });
  const originalIds = allCardIds(initial);

  const afterPlay = transitionWithoutMutation(initial, {
    kind: 'play-cards',
    playerId: 'alice',
    cardIds: [threeDiamonds.id],
  });

  assert.deepEqual(handOf(afterPlay, 'alice'), [...soloHand.slice(1), drawCard]);
  assert.deepEqual(afterPlay.world.tavern, [leftover]);
  assert.equal(afterPlay.world.battle.damageDealt, 3);
  assert.deepEqual(afterPlay.decision, { kind: 'await-damage-discard', requiredDamage: 10 });
  assertCardsInExactlyOneZone(afterPlay, originalIds);
});
