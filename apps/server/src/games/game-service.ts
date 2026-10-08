import { randomBytes, randomUUID } from 'node:crypto';
import { IllegalActionError, setupGame, transition } from '@regicide/game-engine';
import type { GameEvent, GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { toGameView } from '../adapters/game-view.ts';
import { toLobbyView } from '../adapters/lobby-view.ts';
import { toEngineAction } from '../adapters/player-command.ts';
import { deriveAcceptedActionEvents } from './accepted-action-events.ts';
import { gameHub } from './game-hub.ts';
import { gameStore } from './game-store.ts';
import { authenticateSessionPlayer, createSessionPlayer } from './player-auth.ts';
import { buildDevScenario, devScenariosEnabled } from '../testing/scenarios.ts';

const MAX_PLAYERS = 4;

type JoinGameResult =
  | { ok: true; playerId: string; playerToken: string; view: LobbyView }
  | { ok: false; reason: 'game-not-found' | 'game-already-started' | 'lobby-full' };

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

type GetGameResult =
  | { ok: true; view: LobbyView | GameView }
  | { ok: false; reason: 'game-not-found' | 'invalid-credential' };

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
    const view = toLobbyView(session);
    gameHub.publishLobby(gameId, view);
    return { ok: true, playerId: player.id, playerToken, view };
  },

  startGame({
    gameId,
    playerId,
    scenario,
  }: {
    gameId: string;
    playerId: string;
    scenario?: string | undefined;
  }): StartGameResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
    if (!session.players.some((player) => player.id === playerId)) {
      return { ok: false, reason: 'player-not-in-game' };
    }
    if (session.hostPlayerId !== playerId) return { ok: false, reason: 'not-host' };

    const playerIds = session.players.map((player) => player.id);
    let state;
    if (scenario !== undefined) {
      const result = buildDevScenario(scenario, playerIds);
      if (!result.ok) return result;
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
    gameHub.publishGame(gameId, { state, revision: playingSession.revision });
    return { ok: true, view: toGameView(state, playerId) };
  },

  resetDevScenario({
    gameId,
    playerId,
  }: {
    gameId: string;
    playerId: string;
  }): ResetDevScenarioResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase !== 'playing') return { ok: false, reason: 'game-not-started' };
    if (!session.players.some((player) => player.id === playerId)) {
      return { ok: false, reason: 'player-not-in-game' };
    }
    if (session.hostPlayerId !== playerId) return { ok: false, reason: 'not-host' };
    if (!devScenariosEnabled()) return { ok: false, reason: 'scenarios-disabled' };
    if (session.devScenario === undefined) return { ok: false, reason: 'not-scenario-game' };
    const result = buildDevScenario(
      session.devScenario,
      session.players.map((player) => player.id),
    );
    if (!result.ok) return result;
    const state = result.state;
    session.state = state;
    session.revision += 1;
    // nextEventId counts domain events, not state updates. Reset publishes no events.
    gameHub.publishGame(gameId, { state, revision: session.revision });
    return { ok: true, view: toGameView(state, playerId) };
  },

  getGame({
    gameId,
    playerToken,
  }: {
    gameId: string;
    playerToken: string | undefined;
  }): GetGameResult {
    const session = gameStore.get(gameId);
    if (!session) return { ok: false, reason: 'game-not-found' };
    if (session.phase === 'lobby') return { ok: true, view: toLobbyView(session) };
    const playerId = playerToken && authenticateSessionPlayer(session, playerToken);
    if (!playerId) return { ok: false, reason: 'invalid-credential' };
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
    const previousState = session.state;
    let nextState;
    try {
      nextState = transition(previousState, action);
    } catch (error) {
      if (error instanceof IllegalActionError)
        return { ok: false, reason: 'invalid-action', message: error.message };
      throw error;
    }

    // Reserve IDs in event order; commit the counter after all invariants pass.
    const events: GameEvent[] = [];
    for (const event of deriveAcceptedActionEvents(previousState, action, nextState)) {
      events.push({ ...event, id: session.nextEventId + events.length });
    }

    session.nextEventId += events.length;
    session.state = nextState;
    session.revision += 1;
    gameHub.publishGame(gameId, { state: nextState, revision: session.revision }, events);
    return { ok: true, view: toGameView(nextState, playerId) };
  },
};
