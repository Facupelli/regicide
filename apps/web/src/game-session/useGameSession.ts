import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { connectGameSocket } from '../api/game-socket.ts';
import {
  ApiClientError,
  createGame,
  createSoloGame,
  joinGame,
  resetScenario,
  startGame,
  submitAction,
} from '../api/games.ts';
import { useGamePresentation } from '../game-presentation/GamePresentationContext.ts';
import {
  disconnect,
  receiveSnapshot,
  requestAccepted,
  viewVersion,
  visibleSync,
  type LiveState,
  type VisibleSync,
} from './live-sync.ts';

type Identity = { gameId: string; playerId: string; playerToken: string };
type LobbyStart =
  | { status: 'ready' }
  | { status: 'pending' }
  | { status: 'accepted' }
  | { status: 'error'; message: string };
type PlayingOperation = 'idle' | 'submitting' | 'resetting';
type DevScenario = { name: string; origin: 'solo' | 'co-op' };
type PlayingState = {
  status: 'playing';
  view: GameView;
  live: LiveState;
  operation: PlayingOperation;
  actionError: string | null;
  devScenario?: DevScenario | undefined;
} & Identity;
type SessionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'lobby'; view: LobbyView; start: LobbyStart } & Identity)
  | PlayingState
  | { status: 'error'; message: string };

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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function playing(identity: Identity, view: GameView, devScenario?: DevScenario): PlayingState {
  // The server starts at revision 0. The first socket snapshot establishes the client revision.
  return {
    status: 'playing',
    gameId: identity.gameId,
    playerId: identity.playerId,
    playerToken: identity.playerToken,
    view,
    live: { revision: -1, sync: 'connecting' },
    operation: 'idle',
    actionError: null,
    ...(devScenario !== undefined ? { devScenario } : {}),
  };
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

export function useGameSession() {
  const [state, setState] = useState<SessionState>({ status: 'idle' });
  const stateRef = useRef(state);
  const entryInFlight = useRef(false);
  const playingInFlight = useRef(false);
  const pendingScenarioStart = useRef<{ gameId: string; scenario: string } | null>(null);
  const presentation = useGamePresentation();

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const gameId = state.status === 'lobby' || state.status === 'playing' ? state.gameId : undefined;
  const playerToken =
    state.status === 'lobby' || state.status === 'playing' ? state.playerToken : undefined;
  useEffect(() => {
    if (!gameId || !playerToken) return;
    return connectGameSocket({
      gameId,
      playerToken,
      onLobbyUpdated(message) {
        setState((current) =>
          current.status === 'lobby' &&
          current.gameId === gameId &&
          current.playerToken === playerToken
            ? { ...current, view: message.view }
            : current,
        );
      },
      onGameUpdated(message) {
        const current = stateRef.current;
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
            setState({
              ...playing(
                current,
                message.view,
                scenario ? { name: scenario, origin: 'co-op' } : undefined,
              ),
              live: { revision: message.revision, sync: 'ready' },
            });
          });
          return;
        }
        if (message.revision <= current.live.revision) {
          setState((latest) => {
            if (
              latest.status !== 'playing' ||
              latest.gameId !== gameId ||
              latest.playerToken !== playerToken
            )
              return latest;
            const live = receiveSnapshot(latest.live, message.revision);
            return live === latest.live ? latest : { ...latest, live };
          });
          return;
        }
        presentation.presentUpdate(message.events, current.playerId, () => {
          setState((latest) =>
            latest.status === 'playing' &&
            latest.gameId === gameId &&
            latest.playerToken === playerToken &&
            message.revision > latest.live.revision
              ? {
                  ...latest,
                  live: receiveSnapshot(latest.live, message.revision),
                  view: message.view,
                  actionError: null,
                }
              : latest,
          );
        });
      },
      onDisconnected() {
        setState((current) => {
          if (
            current.status !== 'playing' ||
            current.gameId !== gameId ||
            current.playerToken !== playerToken
          )
            return current;
          const live = disconnect(current.live);
          return live === current.live ? current : { ...current, live };
        });
      },
    });
  }, [gameId, playerToken, presentation]);

  async function createCoop() {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    pendingScenarioStart.current = null;
    setState({ status: 'loading' });
    try {
      const response = await createGame();
      setState({ status: 'lobby', ...response, start: { status: 'ready' } });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error, 'Could not create a game') });
    } finally {
      entryInFlight.current = false;
    }
  }

  async function joinCoop(id: string) {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    pendingScenarioStart.current = null;
    setState({ status: 'loading' });
    try {
      const response = await joinGame(id);
      setState({ status: 'lobby', ...response, start: { status: 'ready' } });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error, 'Could not join the game') });
    } finally {
      entryInFlight.current = false;
    }
  }

  async function startSolo(scenario?: string) {
    if (entryInFlight.current || playingInFlight.current) return;
    entryInFlight.current = true;
    presentation.switchSession(null);
    setState({ status: 'loading' });
    try {
      const devScenario = import.meta.env.DEV && scenario ? scenario : undefined;
      const response = await createSoloGame(devScenario);
      presentation.switchSession(response.gameId);
      setState(
        playing(
          response,
          response.view,
          devScenario ? { name: devScenario, origin: 'solo' } : undefined,
        ),
      );
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error, 'Could not start a game') });
    } finally {
      entryInFlight.current = false;
    }
  }

  function startNewSoloGame() {
    const current = stateRef.current;
    const scenario =
      current.status === 'playing' && current.devScenario?.origin === 'solo'
        ? current.devScenario.name
        : undefined;
    return startSolo(scenario);
  }

  async function startCoop(scenario?: string) {
    const current = stateRef.current;
    if (
      current.status !== 'lobby' ||
      current.view.hostPlayerId !== current.playerId ||
      (current.start.status !== 'ready' && current.start.status !== 'error') ||
      entryInFlight.current
    )
      return;
    entryInFlight.current = true;
    setState((latest) =>
      latest.status === 'lobby' &&
      latest.gameId === current.gameId &&
      latest.playerToken === current.playerToken
        ? { ...latest, start: { status: 'pending' } }
        : latest,
    );
    const devScenario = import.meta.env.DEV && scenario ? scenario : undefined;
    pendingScenarioStart.current = devScenario
      ? { gameId: current.gameId, scenario: devScenario }
      : null;
    try {
      // The socket may arrive before the HTTP response. Keep pending context game-scoped.
      await startGame(current.gameId, current.playerToken, devScenario);
      setState((latest) => {
        if (latest.status !== 'lobby' && latest.status !== 'playing') return latest;
        if (latest.gameId !== current.gameId || latest.playerToken !== current.playerToken)
          return latest;
        if (latest.status === 'lobby') return { ...latest, start: { status: 'accepted' } };
        if (devScenario) return { ...latest, devScenario: { name: devScenario, origin: 'co-op' } };
        return latest;
      });
    } catch (error) {
      // A game update may already have confirmed the start despite a lost HTTP response.
      pendingScenarioStart.current = null;
      setState((latest) =>
        latest.status === 'lobby' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken
          ? {
              ...latest,
              start: { status: 'error', message: errorMessage(error, 'Could not start the game') },
            }
          : latest,
      );
    } finally {
      entryInFlight.current = false;
    }
  }

  async function submit(command: PlayerCommand): Promise<'accepted' | 'not-accepted'> {
    const current = stateRef.current;
    if (
      current.status !== 'playing' ||
      current.view.status !== 'active' ||
      current.live.sync !== 'ready' ||
      playingInFlight.current
    )
      return 'not-accepted';
    playingInFlight.current = true;
    setState((latest) =>
      latest.status === 'playing' &&
      latest.gameId === current.gameId &&
      latest.playerToken === current.playerToken
        ? { ...latest, operation: 'submitting', actionError: null }
        : latest,
    );
    try {
      await submitAction(current.gameId, current.playerToken, command);
      // HTTP confirms acceptance; only a newer socket view completes the update.
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken
          ? { ...latest, live: requestAccepted(latest.live, current.live.revision) }
          : latest,
      );
      return 'accepted';
    } catch (error) {
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken &&
        latest.live.revision === current.live.revision
          ? { ...latest, actionError: errorMessage(error, 'Could not submit action') }
          : latest,
      );
      return 'not-accepted';
    } finally {
      playingInFlight.current = false;
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken
          ? { ...latest, operation: 'idle' }
          : latest,
      );
    }
  }

  async function resetCurrentScenario() {
    const current = stateRef.current;
    if (
      current.status !== 'playing' ||
      !import.meta.env.DEV ||
      !current.devScenario ||
      current.live.sync !== 'ready' ||
      playingInFlight.current
    )
      return;
    playingInFlight.current = true;
    setState((latest) =>
      latest.status === 'playing' &&
      latest.gameId === current.gameId &&
      latest.playerToken === current.playerToken
        ? { ...latest, operation: 'resetting', actionError: null }
        : latest,
    );
    try {
      await resetScenario(current.gameId, current.playerToken);
      // HTTP confirms acceptance; only a newer socket view completes the reset.
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken
          ? { ...latest, live: requestAccepted(latest.live, current.live.revision) }
          : latest,
      );
    } catch (error) {
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken &&
        latest.live.revision === current.live.revision
          ? { ...latest, actionError: errorMessage(error, 'Could not reset scenario') }
          : latest,
      );
    } finally {
      playingInFlight.current = false;
      setState((latest) =>
        latest.status === 'playing' &&
        latest.gameId === current.gameId &&
        latest.playerToken === current.playerToken
          ? { ...latest, operation: 'idle' }
          : latest,
      );
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
