import { randomBytes } from 'node:crypto';
import { setupGame } from '@regicide/game-engine';
import type { GameView } from '@regicide/protocol';
import { gameStore } from '../game-store.ts';
import { publishCommittedGame } from '../publish-committed-game.ts';
import { toGameView } from '../protocol/game-view.ts';

type StartGameResult =
  | { ok: true; view: GameView }
  | {
      ok: false;
      reason: 'game-not-found' | 'game-already-started' | 'player-not-in-game' | 'not-host';
    };

export function startGame({
  gameId,
  playerId,
}: {
  gameId: string;
  playerId: string;
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
  const rngState = randomBytes(4).readUInt32BE(0);
  const state = setupGame({ playerIds, rngState });
  const playingSession = {
    ...session,
    phase: 'playing' as const,
    revision: 0,
    nextEventId: 1,
    state,
  };
  gameStore.set(gameId, playingSession);
  publishCommittedGame(gameId, playingSession);
  return { ok: true, view: toGameView(state, playerId, playingSession.players) };
}
