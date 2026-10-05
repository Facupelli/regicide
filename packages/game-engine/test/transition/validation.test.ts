import { test } from 'node:test';
import type { Action } from '../../src/index.ts';
import { assertRejectedWithoutMutation, transitionWithoutMutation } from '../support/assertions.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';
import { makeGameState } from '../support/state.ts';

void test('play validation', async (t) => {
  const fiveClubs = makeCard(5, 'clubs');
  const sixDiamonds = makeCard(6, 'diamonds');
  const fourSpades = makeCard(4, 'spades');
  const twoHearts = makeCard(2, 'hearts');
  const threeDiamonds = makeCard(3, 'diamonds');
  const state = makeGameState({
    players: [
      { id: 'alice', hand: [fiveClubs, sixDiamonds, fourSpades, twoHearts] },
      { id: 'bob', hand: [threeDiamonds] },
    ],
    currentPlayer: 'alice',
    enemy: makeRoyal('jack', 'hearts'),
  });
  const cases: { name: string; action: Action }[] = [
    {
      name: 'rejects the wrong actor',
      action: { kind: 'play-cards', playerId: 'bob', cardIds: [fiveClubs.id] },
    },
    {
      name: 'rejects a card in another player’s hand',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [threeDiamonds.id] },
    },
    {
      name: 'rejects an unknown card',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: ['missing-card'] },
    },
    {
      name: 'rejects an empty play',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [] },
    },
    {
      name: 'rejects duplicate cards',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, fiveClubs.id] },
    },
    {
      name: 'rejects unsupported multi-card plays',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id, sixDiamonds.id] },
    },
    {
      name: 'rejects unsupported Hearts plays',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [twoHearts.id] },
    },
    {
      name: 'rejects a discard action during the play phase',
      action: {
        kind: 'discard-for-damage',
        playerId: 'alice',
        cardIds: [sixDiamonds.id, fourSpades.id],
      },
    },
  ];

  await Promise.all(
    cases.map(({ name, action }) =>
      t.test(name, () => assertRejectedWithoutMutation(state, action)),
    ),
  );
});

void test('damage discard validation', async (t) => {
  const fiveClubs = makeCard(5, 'clubs');
  const sixDiamonds = makeCard(6, 'diamonds');
  const fourSpades = makeCard(4, 'spades');
  const state = transitionWithoutMutation(
    makeGameState({
      players: [
        { id: 'alice', hand: [fiveClubs, sixDiamonds, fourSpades, makeCard(2, 'hearts')] },
        { id: 'bob', hand: [makeCard(3, 'diamonds')] },
      ],
      currentPlayer: 'alice',
      enemy: makeRoyal('jack', 'hearts'),
    }),
    { kind: 'play-cards', playerId: 'alice', cardIds: [fiveClubs.id] },
  );
  const cases: { name: string; action: Action }[] = [
    {
      name: 'rejects the wrong actor',
      action: {
        kind: 'discard-for-damage',
        playerId: 'bob',
        cardIds: [sixDiamonds.id, fourSpades.id],
      },
    },
    {
      name: 'rejects a card already played',
      action: {
        kind: 'discard-for-damage',
        playerId: 'alice',
        cardIds: [fiveClubs.id, fourSpades.id],
      },
    },
    {
      name: 'rejects an unknown card',
      action: { kind: 'discard-for-damage', playerId: 'alice', cardIds: ['missing-card'] },
    },
    {
      name: 'rejects duplicate cards',
      action: {
        kind: 'discard-for-damage',
        playerId: 'alice',
        cardIds: [sixDiamonds.id, sixDiamonds.id],
      },
    },
    {
      name: 'rejects insufficient discard value',
      action: { kind: 'discard-for-damage', playerId: 'alice', cardIds: [sixDiamonds.id] },
    },
    {
      name: 'rejects a play action during the discard phase',
      action: { kind: 'play-cards', playerId: 'alice', cardIds: [sixDiamonds.id] },
    },
  ];

  await Promise.all(
    cases.map(({ name, action }) =>
      t.test(name, () => assertRejectedWithoutMutation(state, action)),
    ),
  );
});
