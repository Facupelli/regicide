import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { GameView, LobbyView } from '@regicide/protocol';
import { ApiClientError, createGame, createSoloGame, joinGame, startGame } from '../api/games.ts';

type Identity = { gameId: string; playerId: string; playerToken: string };
type LobbyStart =
  | { status: 'ready' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

export type SessionScreen =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'lobby'; view: LobbyView; start: LobbyStart } & Identity)
  | ({
      status: 'playing';
      view: GameView;
      revision: number;
      connection: 'connecting' | 'live';
      awaitingUpdate: boolean;
      devScenario?: string | undefined;
    } & Identity)
  | { status: 'error'; message: string };

type PlayingState = Extract<SessionScreen, { status: 'playing' }>;
type ScreenUpdate = (current: SessionScreen) => SessionScreen;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function playing(identity: Identity, view: GameView, devScenario?: string): PlayingState {
  // The server starts at revision 0. The first socket snapshot establishes the client revision.
  return {
    status: 'playing',
    gameId: identity.gameId,
    playerId: identity.playerId,
    playerToken: identity.playerToken,
    view,
    revision: -1,
    connection: 'connecting',
    awaitingUpdate: false,
    ...(devScenario !== undefined ? { devScenario } : {}),
  };
}

export function useGameSession(isPlayingOperationInFlight: () => boolean) {
  const [screen, setScreen] = useState<SessionScreen>({ status: 'idle' });
  const screenRef = useRef(screen);
  const operationInFlight = useRef(false);
  const pendingScenarioStart = useRef<{ gameId: string; scenario: string } | null>(null);
  // Preserve the entry screen's last scenario for New Game until scenario behavior is revisited.
  const lastEntryScenario = useRef('');

  useLayoutEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  async function createCoop(soloScenario: string) {
    if (operationInFlight.current || isPlayingOperationInFlight()) return;
    lastEntryScenario.current = soloScenario;
    operationInFlight.current = true;
    pendingScenarioStart.current = null;
    setScreen({ status: 'loading' });
    try {
      const response = await createGame();
      setScreen({ status: 'lobby', ...response, start: { status: 'ready' } });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not create a game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function joinCoop(id: string, soloScenario: string) {
    if (operationInFlight.current || isPlayingOperationInFlight()) return;
    lastEntryScenario.current = soloScenario;
    operationInFlight.current = true;
    pendingScenarioStart.current = null;
    setScreen({ status: 'loading' });
    try {
      const response = await joinGame(id);
      setScreen({ status: 'lobby', ...response, start: { status: 'ready' } });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not join the game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function startSolo(scenario = lastEntryScenario.current) {
    if (operationInFlight.current || isPlayingOperationInFlight()) return;
    lastEntryScenario.current = scenario;
    operationInFlight.current = true;
    setScreen({ status: 'loading' });
    try {
      const devScenario = import.meta.env.DEV && scenario ? scenario : undefined;
      const response = await createSoloGame(devScenario);
      setScreen(playing(response, response.view, devScenario));
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not start a game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function startCoop(scenario?: string) {
    const current = screenRef.current;
    if (
      current.status !== 'lobby' ||
      current.view.hostPlayerId !== current.playerId ||
      operationInFlight.current
    )
      return;
    operationInFlight.current = true;
    setScreen((screen) =>
      screen.status === 'lobby' &&
      screen.gameId === current.gameId &&
      screen.playerToken === current.playerToken
        ? { ...screen, start: { status: 'pending' } }
        : screen,
    );
    pendingScenarioStart.current = scenario ? { gameId: current.gameId, scenario } : null;
    try {
      // The socket may arrive before the HTTP response. Keep pending context game-scoped.
      await startGame(current.gameId, current.playerToken, scenario);
      if (scenario) {
        setScreen((screen) =>
          screen.status === 'playing' &&
          screen.gameId === current.gameId &&
          screen.playerToken === current.playerToken
            ? { ...screen, devScenario: scenario }
            : screen,
        );
      }
    } catch (error) {
      // A game update may already have confirmed the start despite a lost HTTP response.
      pendingScenarioStart.current = null;
      setScreen((screen) =>
        screen.status === 'lobby' &&
        screen.gameId === current.gameId &&
        screen.playerToken === current.playerToken
          ? {
              ...screen,
              start: { status: 'error', message: errorMessage(error, 'Could not start the game') },
            }
          : screen,
      );
    } finally {
      operationInFlight.current = false;
      setScreen((screen) =>
        screen.status === 'lobby' &&
        screen.gameId === current.gameId &&
        screen.playerToken === current.playerToken &&
        screen.start.status === 'pending'
          ? { ...screen, start: { status: 'ready' } }
          : screen,
      );
    }
  }

  const gameStarted = useCallback(
    (gameId: string, playerToken: string, view: GameView, revision: number) => {
      const current = screenRef.current;
      if (
        current.status !== 'lobby' ||
        current.gameId !== gameId ||
        current.playerToken !== playerToken
      )
        return;
      const devScenario =
        pendingScenarioStart.current?.gameId === gameId
          ? pendingScenarioStart.current.scenario
          : undefined;
      pendingScenarioStart.current = null;
      flushSync(() => {
        setScreen({ ...playing(current, view, devScenario), revision, connection: 'live' });
      });
    },
    [],
  );

  // Temporary live-session bridge: socket/revision/action handling moves here in slice 4.
  const readScreen = useCallback(() => screenRef.current, []);
  const updateScreen = useCallback((update: ScreenUpdate) => setScreen(update), []);

  return {
    screen,
    createCoop,
    joinCoop,
    startSolo,
    startCoop,
    gameStarted,
    readScreen,
    updateScreen,
  };
}
