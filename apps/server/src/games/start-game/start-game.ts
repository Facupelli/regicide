import { randomBytes } from 'node:crypto';
import { setupGame } from '@regicide/game-engine';
import type { GameView } from '@regicide/protocol';
import { gameStore } from '../game-store.ts';
import { publishCommittedGame } from '../publish-committed-game.ts';
import { toGameView } from '../protocol/game-view.ts';
import { buildDevScenario } from '../../testing/scenarios.ts';

type StartGameResult =
  | { ok: true; view: GameView }
  | {
      ok: false;
      reason:
        | 'game-not-found'
        | 'game-already-started'
        | 'player-not-in-game'
        | 'not-host'
        | 'scenarios-disabled'
        | 'unknown-scenario';
    }
  | { ok: false; reason: 'invalid-scenario'; message: string };

export function startGame({
  gameId,
  playerId,
  scenario,
}: {
  gameId: string;
  playerId: string;
  scenario?: string | undefined;
}): StartGameResult {
  const session = gameStore.get(gameId);
  if (!session) {
    return { ok: false, reason: 'game-not-found' };
  }
  if (session.phase !== 'lobby') {
    return { ok: false, reason: 'game-already-started' };
  }
  if (!session.players.some((player) => player.id === playerId)) {
    return { ok: false, reason: 'player-not-in-game' };
  }
  if (session.hostPlayerId !== playerId) {
    return { ok: false, reason: 'not-host' };
  }

  const playerIds = session.players.map((player) => player.id);
  let state;
  if (scenario !== undefined) {
    const result = buildDevScenario(scenario, playerIds);
    if (!result.ok) {
      return result;
    }
    state = result.state;
  } else {
    const rngState = randomBytes(4).readUInt32BE(0);
    state = setupGame({ playerIds, rngState });
  }
  const playingSession = {
    ...session,
    phase: 'playing' as const,
    revision: 0,
    nextEventId: 1,
    state,
    ...(scenario !== undefined ? { devScenario: scenario } : {}),
  };
  gameStore.set(gameId, playingSession);
  publishCommittedGame(gameId, playingSession);
  return { ok: true, view: toGameView(state, playerId, playingSession.players) };
}
