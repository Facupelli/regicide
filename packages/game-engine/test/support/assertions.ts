import assert from 'node:assert/strict';
import { transition, type Action, type Card, type GameState } from '../../src/index.ts';

export function handOf(state: GameState, playerId: string): readonly Card[] {
  const player = state.world.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player.hand;
}

export function allCardIds(state: GameState): string[] {
  const { players, battle, tavern, discard, castle } = state.world;
  return [
    ...players.flatMap((player) => player.hand),
    battle.enemy,
    ...battle.playedCards,
    ...tavern,
    ...discard,
    ...castle,
  ].map((card) => card.id);
}

export function assertCardsInExactlyOneZone(state: GameState, originalIds: string[]): void {
  const ids = allCardIds(state);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.toSorted(), originalIds.toSorted());
}

export function transitionWithoutMutation(state: GameState, action: Action): GameState {
  const before = structuredClone(state);
  const result = transition(state, action);
  assert.deepEqual(state, before);
  return result;
}

export function assertRejectedWithoutMutation(state: GameState, action: Action): void {
  const before = structuredClone(state);
  assert.throws(() => transition(state, action));
  assert.deepEqual(state, before);
}
