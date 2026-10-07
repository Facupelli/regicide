import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { connectGameSocket } from './api/game-socket.ts';
import {
  ApiClientError,
  createGame,
  createSoloGame,
  joinGame,
  resetScenario,
  startGame,
  submitAction,
} from './api/games.ts';
import { EntryScreen } from './components/entry/EntryScreen.tsx';
import { LobbyScreen } from './components/lobby/LobbyScreen.tsx';
import { PlayingScreen } from './components/game/PlayingScreen.tsx';
import { useGamePresentation } from './game-presentation/GamePresentationContext.ts';

type Identity = { gameId: string; playerId: string; playerToken: string };
type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'lobby'; view: LobbyView } & Identity)
  | ({
      status: 'playing';
      view: GameView;
      revision: number;
      connection: 'connecting' | 'live';
      awaitingUpdate: boolean;
      devScenario?: string | undefined;
    } & Identity)
  | { status: 'error'; message: string };

type PlayingState = Extract<ScreenState, { status: 'playing' }>;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });
  const screenRef = useRef(screen);
  const presentation = useGamePresentation();
  const presentationSessionKey = screen.status === 'playing' ? screen.gameId : null;
  const previousPresentationSessionKey = useRef(presentationSessionKey);

  useLayoutEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useLayoutEffect(() => {
    if (previousPresentationSessionKey.current !== presentationSessionKey) {
      previousPresentationSessionKey.current = presentationSessionKey;
      presentation.reset();
    }
  }, [presentation, presentationSessionKey]);
  // Preserve the entry screen's last scenario for New Game until scenario behavior is revisited.
  const lastEntryScenario = useRef('');
  const [lobbyPending, setLobbyPending] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ revision: number; message: string } | null>(
    null,
  );
  const [actionPending, setActionPending] = useState(false);
  const operationInFlight = useRef(false);
  const actionInFlight = useRef(false);
  const resetInFlight = useRef(false);
  const [resetPending, setResetPending] = useState(false);
  const pendingScenarioStart = useRef<{ gameId: string; scenario: string } | null>(null);

  const gameId =
    screen.status === 'lobby' || screen.status === 'playing' ? screen.gameId : undefined;
  const playerToken =
    screen.status === 'lobby' || screen.status === 'playing' ? screen.playerToken : undefined;
  useEffect(() => {
    if (!gameId || !playerToken) return;
    return connectGameSocket({
      gameId,
      playerToken,
      onLobbyUpdated(message) {
        setScreen((current) =>
          current.status === 'lobby' &&
          current.gameId === gameId &&
          current.playerToken === playerToken
            ? { ...current, view: message.view }
            : current,
        );
      },
      onGameUpdated(message) {
        const current = screenRef.current;
        if (
          (current.status !== 'lobby' && current.status !== 'playing') ||
          current.gameId !== gameId ||
          current.playerToken !== playerToken
        ) {
          return;
        }
        if (current.status === 'lobby') {
          const devScenario =
            pendingScenarioStart.current?.gameId === gameId
              ? pendingScenarioStart.current.scenario
              : undefined;
          pendingScenarioStart.current = null;
          flushSync(() => {
            setScreen({
              ...playing(current, message.view, devScenario),
              revision: message.revision,
              connection: 'live',
            });
          });
          return;
        }
        if (message.revision <= current.revision) {
          if (current.connection !== 'live') setScreen({ ...current, connection: 'live' });
          return;
        }
        const prepared = presentation.prepare(message.events, current.playerId);
        flushSync(() => {
          setScreen({
            ...current,
            revision: message.revision,
            view: message.view,
            connection: 'live',
            awaitingUpdate: false,
          });
        });
        presentation.enqueue(prepared);
      },
      onDisconnected() {
        setScreen((current) =>
          current.status === 'playing' &&
          current.gameId === gameId &&
          current.playerToken === playerToken
            ? { ...current, connection: 'connecting' }
            : current,
        );
      },
    });
  }, [gameId, playerToken, presentation]);

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

  async function createCoop(soloScenario: string) {
    if (operationInFlight.current || actionInFlight.current) return;
    lastEntryScenario.current = soloScenario;
    operationInFlight.current = true;
    pendingScenarioStart.current = null;
    setScreen({ status: 'loading' });
    setLobbyError(null);
    try {
      const response = await createGame();
      setScreen({ status: 'lobby', ...response });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not create a game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function joinCoop(id: string, soloScenario: string) {
    if (operationInFlight.current || actionInFlight.current) return;
    lastEntryScenario.current = soloScenario;
    operationInFlight.current = true;
    pendingScenarioStart.current = null;
    setScreen({ status: 'loading' });
    setLobbyError(null);
    try {
      const response = await joinGame(id);
      setScreen({ status: 'lobby', ...response });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not join the game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function startSolo(scenario = lastEntryScenario.current) {
    if (operationInFlight.current || actionInFlight.current || resetInFlight.current) return;
    lastEntryScenario.current = scenario;
    operationInFlight.current = true;
    setScreen({ status: 'loading' });
    setActionError(null);
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
    if (
      screen.status !== 'lobby' ||
      screen.view.hostPlayerId !== screen.playerId ||
      operationInFlight.current
    )
      return;
    operationInFlight.current = true;
    setLobbyPending(true);
    setLobbyError(null);
    pendingScenarioStart.current = scenario ? { gameId: screen.gameId, scenario } : null;
    try {
      // The socket may arrive before the HTTP response. Keep pending context game-scoped.
      await startGame(screen.gameId, screen.playerToken, scenario);
      if (scenario) {
        setScreen((current) =>
          current.status === 'playing' && current.gameId === screen.gameId
            ? { ...current, devScenario: scenario }
            : current,
        );
      }
    } catch (error) {
      // A game update may already have confirmed the start despite a lost HTTP response.
      pendingScenarioStart.current = null;
      setLobbyError(errorMessage(error, 'Could not start the game'));
    } finally {
      operationInFlight.current = false;
      setLobbyPending(false);
    }
  }

  async function sendAction(command: PlayerCommand) {
    if (
      screen.status !== 'playing' ||
      screen.view.status !== 'active' ||
      screen.connection !== 'live' ||
      screen.awaitingUpdate ||
      actionInFlight.current ||
      resetInFlight.current
    )
      return;
    actionInFlight.current = true;
    setActionPending(true);
    setActionError(null);
    try {
      await submitAction(screen.gameId, screen.playerToken, command);
      // The HTTP response confirms success; the socket supplies the resulting shared view.
      setScreen((current) =>
        current.status === 'playing' &&
        current.gameId === screen.gameId &&
        current.playerToken === screen.playerToken &&
        current.revision <= screen.revision
          ? { ...current, awaitingUpdate: true }
          : current,
      );
    } catch (error) {
      setActionError({
        revision: screen.revision,
        message: errorMessage(error, 'Could not submit action'),
      });
    } finally {
      actionInFlight.current = false;
      setActionPending(false);
    }
  }

  async function resetCurrentScenario() {
    if (
      screen.status !== 'playing' ||
      !import.meta.env.DEV ||
      !screen.devScenario ||
      screen.connection !== 'live' ||
      screen.awaitingUpdate ||
      actionInFlight.current ||
      resetInFlight.current
    )
      return;
    resetInFlight.current = true;
    setResetPending(true);
    setActionError(null);
    try {
      await resetScenario(screen.gameId, screen.playerToken);
      // The socket supplies the new revision and player-specific view.
      setScreen((current) =>
        current.status === 'playing' &&
        current.gameId === screen.gameId &&
        current.playerToken === screen.playerToken &&
        current.revision <= screen.revision
          ? { ...current, awaitingUpdate: true }
          : current,
      );
    } catch (error) {
      setActionError({
        revision: screen.revision,
        message: errorMessage(error, 'Could not reset scenario'),
      });
    } finally {
      resetInFlight.current = false;
      setResetPending(false);
    }
  }

  if (screen.status === 'playing') {
    return (
      <PlayingScreen
        view={screen.view}
        revision={screen.revision}
        connection={screen.connection}
        awaitingUpdate={screen.awaitingUpdate}
        actionPending={actionPending}
        resetPending={resetPending}
        actionError={actionError?.revision === screen.revision ? actionError.message : null}
        onAction={sendAction}
        onNewGame={() => void startSolo()}
        onResetScenario={
          import.meta.env.DEV && screen.devScenario ? resetCurrentScenario : undefined
        }
      />
    );
  }

  if (screen.status === 'lobby') {
    return (
      <LobbyScreen
        gameId={screen.gameId}
        playerId={screen.playerId}
        view={screen.view}
        pending={lobbyPending}
        error={lobbyError}
        onStart={startCoop}
      />
    );
  }

  return (
    <EntryScreen
      loading={screen.status === 'loading'}
      error={screen.status === 'error' ? screen.message : null}
      onCreateCoop={createCoop}
      onJoinCoop={joinCoop}
      onStartSolo={startSolo}
    />
  );
}

export default App;
