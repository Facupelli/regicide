import type { GameState } from '@regicide/game-engine';
import { makeCard, makeGameState, makeRoyal } from '@regicide/game-engine/testing';

type DevScenarioFactory = (playerIds: readonly string[]) => GameState;

class InvalidDevScenarioError extends Error {}

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

type BuildDevScenarioResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'scenarios-disabled' | 'unknown-scenario' }
  | { ok: false; reason: 'invalid-scenario'; message: string };

export function devScenariosEnabled(): boolean {
  return process.env.REGICIDE_DEV_SCENARIOS === '1';
}

export function buildDevScenario(
  name: string,
  playerIds: readonly string[],
): BuildDevScenarioResult {
  if (!devScenariosEnabled()) {
    return { ok: false, reason: 'scenarios-disabled' };
  }
  const factory = Object.hasOwn(devScenarios, name) ? devScenarios[name] : undefined;
  if (!factory) {
    return { ok: false, reason: 'unknown-scenario' };
  }
  try {
    return { ok: true, state: factory(playerIds) };
  } catch (error) {
    if (error instanceof InvalidDevScenarioError) {
      return { ok: false, reason: 'invalid-scenario', message: error.message };
    }
    throw error;
  }
}
