import { useEffect, useEffectEvent, useReducer, useRef } from 'react';
import type {
  GameUpdatedMessage,
  GameView,
  LobbyUpdatedMessage,
  LobbyView,
  PlayerCommand,
} from '@regicide/protocol';
import { connectGameSocket } from './game-socket.ts';
import {
  ApiClientError,
  createGame,
  createSoloGame,
  joinGame,
  resetScenario,
  startGame,
  submitAction,
} from './games-api.ts';
import { useGamePresentation } from '../game/presentation/GamePresentationContext.ts';
import { viewVersion, visibleSync, type VisibleSync } from './live-sync.ts';
import {
  initialSessionState,
  sessionReducer,
  type LobbyStart,
  type PlayingOperation,
  type SessionState,
} from './session-state.ts';

export type SessionScreen =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'lobby'; gameId: string; playerId: string; view: LobbyView; start: LobbyStart }
  | {
      status: 'playing';
      view: GameView;
      viewVersion: string;
      sync: VisibleSync;
      operation: PlayingOperation;
      actionError: string | null;
      canResetScenario: boolean;
    };

export function useGameSession() {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const entryInFlight = useRef(false);
  const playingInFlight = useRef(false);
  const pendingScenarioStart = useRef<{ gameId: string; scenario: string } | null>(null);
  const presentation = useGamePresentation();

  const gameId = state.status === 'lobby' || state.status === 'playing' ? state.gameId : undefined;
  const playerToken =
    state.status === 'lobby' || state.status === 'playing' ? state.playerToken : undefined;

  const onLobbyUpdated = useEffectEvent(
    (gameId: string, playerToken: string, message: LobbyUpdatedMessage) => {
      dispatch({ type: 'lobby-updated', gameId, playerToken, view: message.view });
    },
  );

  const onGameUpdated = useEffectEvent(
    (gameId: string, playerToken: string, message: GameUpdatedMessage) => {
      const current = state;
      if (
        (current.status !== 'lobby' && current.status !== 'playing') ||
        current.gameId !== gameId ||
        current.playerToken !== playerToken
      ) {
        return;
      }
      if (current.status === 'lobby') {
        const scenario =
          pendingScenarioStart.current?.gameId === gameId
            ? pendingScenarioStart.current.scenario
            : undefined;
        pendingScenarioStart.current = null;
        presentation.switchSession(gameId);
        presentation.presentUpdate([], current.playerId, () => {
          dispatch({
            type: 'lobby-game-started',
            gameId,
            playerToken,
            view: message.view,
            revision: message.revision,
            ...(scenario ? { devScenario: { name: scenario, origin: 'co-op' as const } } : {}),
          });
        });
        return;
      }
      if (message.revision <= current.live.revision) {
        dispatch({ type: 'snapshot-observed', gameId, playerToken, revision: message.revision });
        return;
      }
      presentation.presentUpdate(message.events, current.playerId, () => {
        dispatch({
          type: 'snapshot-received',
          gameId,
          playerToken,
          revision: message.revision,
          view: message.view,
        });
      });
    },
  );

  const onDisconnected = useEffectEvent((gameId: string, playerToken: string) => {
    dispatch({ type: 'disconnected', gameId, playerToken });
  });

  useEffect(() => {
    if (!gameId || !playerToken) return;
    return connectGameSocket({
      gameId,
      playerToken,
      onLobbyUpdated: (message) => onLobbyUpdated(gameId, playerToken, message),
      onGameUpdated: (message) => onGameUpdated(gameId, playerToken, message),
      onDisconnected: () => onDisconnected(gameId, playerToken),
    });
  }, [gameId, playerToken]);

  async function createCoop() {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    pendingScenarioStart.current = null;
    dispatch({ type: 'session-load-started' });
    try {
      const response = await createGame();
      dispatch({ type: 'lobby-entered', identity: response, view: response.view });
    } catch (error) {
      dispatch({
        type: 'session-load-failed',
        message: errorMessage(error, 'Could not create a game'),
      });
    } finally {
      entryInFlight.current = false;
    }
  }

  async function joinCoop(id: string) {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    pendingScenarioStart.current = null;
    dispatch({ type: 'session-load-started' });
    try {
      const response = await joinGame(id);
      dispatch({ type: 'lobby-entered', identity: response, view: response.view });
    } catch (error) {
      dispatch({
        type: 'session-load-failed',
        message: errorMessage(error, 'Could not join the game'),
      });
    } finally {
      entryInFlight.current = false;
    }
  }

  async function startSolo(scenario?: string) {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    presentation.switchSession(null);
    dispatch({ type: 'session-load-started' });
    try {
      const devScenario = import.meta.env.DEV && scenario ? scenario : undefined;
      const response = await createSoloGame(devScenario);
      presentation.switchSession(response.gameId);
      dispatch({
        type: 'solo-game-started',
        identity: response,
        view: response.view,
        ...(devScenario ? { devScenario: { name: devScenario, origin: 'solo' as const } } : {}),
      });
    } catch (error) {
      dispatch({
        type: 'session-load-failed',
        message: errorMessage(error, 'Could not start a game'),
      });
    } finally {
      entryInFlight.current = false;
    }
  }

  function startNewSoloGame() {
    const current = state;
    const scenario =
      current.status === 'playing' && current.devScenario?.origin === 'solo'
        ? current.devScenario.name
        : undefined;
    return startSolo(scenario);
  }

  async function startCoop(scenario?: string) {
    const current = state;
    if (
      current.status !== 'lobby' ||
      current.view.hostPlayerId !== current.playerId ||
      (current.start.status !== 'ready' && current.start.status !== 'error') ||
      entryInFlight.current
    ) {
      return;
    }

    entryInFlight.current = true;
    dispatch({ type: 'start-requested', gameId: current.gameId, playerToken: current.playerToken });
    const devScenario = import.meta.env.DEV && scenario ? scenario : undefined;
    pendingScenarioStart.current = devScenario
      ? { gameId: current.gameId, scenario: devScenario }
      : null;
    try {
      // The socket may arrive before the HTTP response. Keep pending context game-scoped.
      await startGame(current.gameId, current.playerToken, devScenario);
      dispatch({
        type: 'start-accepted',
        gameId: current.gameId,
        playerToken: current.playerToken,
        ...(devScenario ? { devScenario: { name: devScenario, origin: 'co-op' as const } } : {}),
      });
    } catch (error) {
      // A game update may already have confirmed the start despite a lost HTTP response.
      pendingScenarioStart.current = null;
      dispatch({
        type: 'start-failed',
        gameId: current.gameId,
        playerToken: current.playerToken,
        message: errorMessage(error, 'Could not start the game'),
      });
    } finally {
      entryInFlight.current = false;
    }
  }

  async function submit(command: PlayerCommand): Promise<'accepted' | 'not-accepted'> {
    const current = state;
    if (
      current.status !== 'playing' ||
      current.view.status !== 'active' ||
      current.live.sync !== 'ready' ||
      playingInFlight.current
    ) {
      return 'not-accepted';
    }

    playingInFlight.current = true;
    dispatch({
      type: 'operation-started',
      gameId: current.gameId,
      playerToken: current.playerToken,
      operation: 'submitting',
    });
    try {
      await submitAction(current.gameId, current.playerToken, command);
      // HTTP confirms acceptance; only a newer socket view completes the update.
      dispatch({
        type: 'operation-accepted',
        gameId: current.gameId,
        playerToken: current.playerToken,
        submittedAtRevision: current.live.revision,
      });
      return 'accepted';
    } catch (error) {
      dispatch({
        type: 'operation-failed',
        gameId: current.gameId,
        playerToken: current.playerToken,
        submittedAtRevision: current.live.revision,
        message: errorMessage(error, 'Could not submit action'),
      });
      return 'not-accepted';
    } finally {
      playingInFlight.current = false;
      dispatch({
        type: 'operation-finished',
        gameId: current.gameId,
        playerToken: current.playerToken,
      });
    }
  }

  async function resetCurrentScenario() {
    const current = state;
    if (
      current.status !== 'playing' ||
      !import.meta.env.DEV ||
      !current.devScenario ||
      current.live.sync !== 'ready' ||
      playingInFlight.current
    ) {
      return;
    }

    playingInFlight.current = true;
    dispatch({
      type: 'operation-started',
      gameId: current.gameId,
      playerToken: current.playerToken,
      operation: 'resetting',
    });
    try {
      await resetScenario(current.gameId, current.playerToken);
      // HTTP confirms acceptance; only a newer socket view completes the reset.
      dispatch({
        type: 'operation-accepted',
        gameId: current.gameId,
        playerToken: current.playerToken,
        submittedAtRevision: current.live.revision,
      });
    } catch (error) {
      dispatch({
        type: 'operation-failed',
        gameId: current.gameId,
        playerToken: current.playerToken,
        submittedAtRevision: current.live.revision,
        message: errorMessage(error, 'Could not reset scenario'),
      });
    } finally {
      playingInFlight.current = false;
      dispatch({
        type: 'operation-finished',
        gameId: current.gameId,
        playerToken: current.playerToken,
      });
    }
  }

  return {
    screen: toScreen(state),
    createCoop,
    joinCoop,
    startSolo,
    startNewSoloGame,
    startCoop,
    submit,
    resetCurrentScenario,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function toScreen(state: SessionState): SessionScreen {
  if (state.status === 'lobby') {
    return {
      status: 'lobby',
      gameId: state.gameId,
      playerId: state.playerId,
      view: state.view,
      start: state.start,
    };
  }
  if (state.status === 'playing') {
    return {
      status: 'playing',
      view: state.view,
      viewVersion: viewVersion(state.gameId, state.live),
      sync: visibleSync(state.live),
      operation: state.operation,
      actionError: state.actionError,
      canResetScenario: import.meta.env.DEV && Boolean(state.devScenario),
    };
  }
  return state;
}
