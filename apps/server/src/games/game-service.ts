import { randomBytes, randomUUID } from 'node:crypto';
import { setupGame, transition } from '@regicide/game-engine';
import type { GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { toGameView } from '../adapters/game-view.ts';
import { toLobbyView } from '../adapters/lobby-view.ts';
import { toEngineAction } from '../adapters/player-command.ts';
import { gameStore } from './game-store.ts';
import { createSessionPlayer } from './player-auth.ts';

const MAX_PLAYERS = 4;

type JoinGameResult =
  | { ok: true; playerId: string; playerToken: string; view: LobbyView }
  | { ok: false; reason: 'game-not-found' | 'game-already-started' | 'lobby-full' };

type StartGameResult =
  | { ok: true; view: GameView }
  | {
      ok: false;
      reason: 'game-not-found' | 'game-already-started' | 'player-not-in-game' | 'not-host';
    };

type GetGameResult =
  | { ok: true; view: LobbyView | GameView }
  | { ok: false; reason: 'game-not-found' | 'player-id-required' | 'player-not-in-game' };

type SubmitCommandResult =
  | { ok: true; view: GameView }
  | { ok: false; reason: 'game-not-found' | 'game-not-started' | 'player-not-in-game' }
  | { ok: false; reason: 'invalid-action'; message: string };

export const gameService = {
  createGame(): { gameId: string; playerId: string; playerToken: string; view: LobbyView } {
    const gameId = randomUUID();
    const { player, playerToken } = createSessionPlayer();
    const session = {
      phase: 'lobby' as const,
      hostPlayerId: player.id,
      players: [player],
    };
    gameStore.set(gameId, session);
    return { gameId, playerId: player.id, playerToken, view: toLobbyView(session) };
  },

  joinGame({ gameId }: { gameId: string }): JoinGameResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
    if (session.players.length >= MAX_PLAYERS) return { ok: false, reason: 'lobby-full' };

    const { player, playerToken } = createSessionPlayer();
    session.players.push(player);
    return { ok: true, playerId: player.id, playerToken, view: toLobbyView(session) };
  },

  startGame({ gameId, playerId }: { gameId: string; playerId: string }): StartGameResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
    if (!session.players.some((player) => player.id === playerId)) {
      return { ok: false, reason: 'player-not-in-game' };
    }
    if (session.hostPlayerId !== playerId) return { ok: false, reason: 'not-host' };

    const rngState = randomBytes(4).readUInt32BE(0);
    const state = setupGame({ playerIds: session.players.map((player) => player.id), rngState });
    gameStore.set(gameId, { ...session, phase: 'playing', state });
    return { ok: true, view: toGameView(state, playerId) };
  },

  getGame({ gameId, playerId }: { gameId: string; playerId: string | undefined }): GetGameResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase === 'lobby') return { ok: true, view: toLobbyView(session) };
    if (!playerId) return { ok: false, reason: 'player-id-required' };
    if (!session.players.some((player) => player.id === playerId)) {
      return { ok: false, reason: 'player-not-in-game' };
    }
    return { ok: true, view: toGameView(session.state, playerId) };
  },

  submitCommand({
    gameId,
    playerId,
    command,
  }: {
    gameId: string;
    playerId: string;
    command: PlayerCommand;
  }): SubmitCommandResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase !== 'playing') return { ok: false, reason: 'game-not-started' };
    if (!session.players.some((player) => player.id === playerId)) {
      return { ok: false, reason: 'player-not-in-game' };
    }

    const action = toEngineAction(command, playerId);
    let nextState;
    try {
      nextState = transition(session.state, action);
    } catch (error) {
      if (error instanceof Error)
        return { ok: false, reason: 'invalid-action', message: error.message };
      throw error;
    }

    session.state = nextState;
    return { ok: true, view: toGameView(nextState, playerId) };
  },
};
