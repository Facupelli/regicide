import { randomBytes, randomUUID } from 'node:crypto';
import { setupGame, transition } from '@regicide/game-engine';
import type { GameEvent, GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { toProtocolCard } from '../adapters/card.ts';
import { toGameView } from '../adapters/game-view.ts';
import { toLobbyView } from '../adapters/lobby-view.ts';
import { toEngineAction } from '../adapters/player-command.ts';
import { gameHub } from './game-hub.ts';
import { gameStore } from './game-store.ts';
import { createSessionPlayer } from './player-auth.ts';
import { getDevScenario, InvalidDevScenarioError } from '../testing/scenarios.ts';

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
    gameHub.publishLobby(gameId);
    return { ok: true, playerId: player.id, playerToken, view: toLobbyView(session) };
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
      if (process.env.REGICIDE_DEV_SCENARIOS !== '1') {
        return { ok: false, reason: 'scenarios-disabled' };
      }
      const factory = getDevScenario(scenario);
      if (!factory) return { ok: false, reason: 'unknown-scenario' };
      try {
        state = factory(playerIds);
      } catch (error) {
        if (error instanceof InvalidDevScenarioError) {
          return { ok: false, reason: 'invalid-scenario', message: error.message };
        }
        throw error;
      }
    } else {
      const rngState = randomBytes(4).readUInt32BE(0);
      state = setupGame({ playerIds, rngState });
    }
    gameStore.set(gameId, {
      ...session,
      phase: 'playing',
      revision: 0,
      nextEventId: 1,
      state,
      ...(scenario !== undefined ? { devScenario: scenario } : {}),
    });
    gameHub.publishGame(gameId);
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
    if (process.env.REGICIDE_DEV_SCENARIOS !== '1') {
      return { ok: false, reason: 'scenarios-disabled' };
    }
    if (session.devScenario === undefined) return { ok: false, reason: 'not-scenario-game' };
    const factory = getDevScenario(session.devScenario);
    if (!factory) return { ok: false, reason: 'unknown-scenario' };

    let state;
    try {
      state = factory(session.players.map((player) => player.id));
    } catch (error) {
      if (error instanceof InvalidDevScenarioError) {
        return { ok: false, reason: 'invalid-scenario', message: error.message };
      }
      throw error;
    }
    session.state = state;
    session.revision += 1;
    // nextEventId counts domain events, not state updates. Reset publishes no events.
    gameHub.publishGame(gameId);
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

    const events: GameEvent[] = [];
    if (action.kind === 'discard-for-damage' && action.cardIds.length > 0) {
      // The engine appends the selected cards in discard order. Use its result, not request data.
      const discarded = nextState.world.discard.slice(session.state.world.discard.length);
      if (discarded.length !== action.cardIds.length) {
        throw new Error('Damage discard did not append the expected number of cards');
      }
      const cards = discarded.map(toProtocolCard);
      events.push({
        id: session.nextEventId,
        type: 'cardsDiscardedForDamage',
        playerId,
        cards,
      });
      session.nextEventId += 1;
    }

    session.state = nextState;
    session.revision += 1;
    gameHub.publishGame(gameId, events);
    return { ok: true, view: toGameView(nextState, playerId) };
  },
};
