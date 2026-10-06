import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soloVictoryRank, type GameState } from '../../src/index.ts';

type Win = Extract<GameState, { kind: 'game-over'; result: 'win' }>;

for (const [soloJestersUsed, expected] of [
  [0, 'gold'],
  [1, 'silver'],
  [2, 'bronze'],
  [null, null],
] as const) {
  void test(`a win with ${String(soloJestersUsed)} solo Jesters used has rank ${String(expected)}`, () => {
    const won: Win = {
      kind: 'game-over',
      result: 'win',
      world: {
        players: [
          { id: 'alice', hand: [] },
          ...(soloJestersUsed === null ? [{ id: 'bob', hand: [] }] : []),
        ],
        currentPlayer: 'alice',
        consecutiveYields: 0,
        soloJestersUsed,
        tavern: [],
        discard: [],
        castle: [],
        rngState: 1,
      },
    };

    assert.equal(soloVictoryRank(won), expected);
  });
}
