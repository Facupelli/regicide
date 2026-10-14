import type { GameView } from '@regicide/protocol';
import { cancelAgentExecution } from '../../agents/agent-coordinator.ts';
import { gameStore } from '../game-store.ts';
import { publishCommittedGame } from '../publish-committed-game.ts';
import { toGameView } from '../protocol/game-view.ts';
import { buildDevScenario, devScenariosEnabled } from '../../testing/scenarios.ts';

type ResetDevScenarioResult =
  | { ok: true; view: GameView }
  | {
      ok: false;
      reason:
        | 'game-not-found'
        | 'game-not-started'
        | 'player-not-in-game'
        | 'not-host'
        | 'scenarios-disabled'
        | 'not-scenario-game'
        | 'unknown-scenario';
    }
  | { ok: false; reason: 'invalid-scenario'; message: string };

export function resetDevScenario({
  gameId,
  playerId,
}: {
  gameId: string;
  playerId: string;
}): ResetDevScenarioResult {
  const session = gameStore.get(gameId);
  if (!session) {
    return { ok: false, reason: 'game-not-found' };
  }
  if (session.phase !== 'playing') {
    return { ok: false, reason: 'game-not-started' };
  }
  if (!session.players.some((player) => player.id === playerId)) {
    return { ok: false, reason: 'player-not-in-game' };
  }
  if (session.hostPlayerId !== playerId) {
    return { ok: false, reason: 'not-host' };
  }
  if (!devScenariosEnabled()) {
    return { ok: false, reason: 'scenarios-disabled' };
  }
  if (session.devScenario === undefined) {
    return { ok: false, reason: 'not-scenario-game' };
  }
  const result = buildDevScenario(
    session.devScenario,
    session.players.map((player) => player.id),
  );
  if (!result.ok) {
    return result;
  }
  const state = result.state;
  session.state = state;
  session.revision += 1;
  cancelAgentExecution(gameId, 'scenario-reset');
  // nextEventId counts domain events, not state updates. Reset publishes no events.
  publishCommittedGame(gameId, session);
  return { ok: true, view: toGameView(state, playerId, session.players) };
}
