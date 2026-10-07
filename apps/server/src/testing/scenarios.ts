import type { GameState } from '@regicide/game-engine';
import { makeCard, makeGameState, makeRoyal } from '@regicide/game-engine/testing';

type DevScenarioFactory = (playerIds: readonly string[]) => GameState;

export class InvalidDevScenarioError extends Error {}

export function createEnemyDefeatExactVsOverkill(playerIds: readonly string[]): GameState {
  const playerId = playerIds[0];
  if (playerId === undefined) {
    throw new InvalidDevScenarioError(
      'Enemy defeat exact vs overkill requires at least one player',
    );
  }

  return makeGameState({
    players: [
      { id: playerId, hand: [makeCard(9, 'spades'), makeCard(10, 'spades')] },
      ...playerIds.slice(1).map((id) => ({ id, hand: [] })),
    ],
    currentPlayer: playerId,
    enemy: makeRoyal('jack', 'spades'),
    damageDealt: 11,
    soloJestersUsed: playerIds.length === 1 ? 0 : null,
    castle: [makeRoyal('king', 'hearts')],
  });
}

const devScenarios: Record<string, DevScenarioFactory> = {
  'enemy-defeat-exact-vs-overkill': createEnemyDefeatExactVsOverkill,
};

export function getDevScenario(name: string): DevScenarioFactory | undefined {
  return Object.hasOwn(devScenarios, name) ? devScenarios[name] : undefined;
}
