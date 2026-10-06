import assert from 'node:assert/strict';
import { transition, type Action, type Card, type GameState } from '../../src/index.ts';

export function handOf(state: GameState, playerId: string): readonly Card[] {
  const player = state.world.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player.hand;
}

export function allCardIds(state: GameState): string[] {
  const { players, tavern, discard, castle } = state.world;
  const battleCards: Card[] =
    state.kind === 'game-over' && state.result === 'win'
      ? []
      : [
          state.world.battle.enemy,
          ...state.world.battle.plays.flatMap<Card>((play) =>
            play.kind === 'attack' ? play.cards : [play.card],
          ),
        ];
  return [
    ...players.flatMap((player) => player.hand),
    ...battleCards,
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

export function transitionWithBattle(
  state: GameState,
  action: Action,
): Exclude<GameState, { result: 'win' }> {
  const result = transitionWithoutMutation(state, action);
  if (result.kind === 'game-over' && result.result === 'win') {
    throw new Error('Expected the battle to continue or end in loss');
  }
  return result;
}

export function assertRejectedWithoutMutation(state: GameState, action: Action): void {
  const before = structuredClone(state);
  assert.throws(() => transition(state, action));
  assert.deepEqual(state, before);
}
