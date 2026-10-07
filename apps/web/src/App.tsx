import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { PlayerCommand } from '@regicide/protocol';
import { connectGameSocket } from './api/game-socket.ts';
import { ApiClientError, resetScenario, submitAction } from './api/games.ts';
import { EntryScreen } from './components/entry/EntryScreen.tsx';
import { LobbyScreen } from './components/lobby/LobbyScreen.tsx';
import { PlayingScreen } from './components/game/PlayingScreen.tsx';
import { useGamePresentation } from './game-presentation/GamePresentationContext.ts';
import { useGameSession } from './game-session/useGameSession.ts';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const actionInFlight = useRef(false);
  const resetInFlight = useRef(false);
  const session = useGameSession(() => actionInFlight.current || resetInFlight.current);
  const { screen, readScreen, updateScreen, gameStarted } = session;
  const presentation = useGamePresentation();
  const presentationSessionKey = screen.status === 'playing' ? screen.gameId : null;
  const previousPresentationSessionKey = useRef(presentationSessionKey);

  useLayoutEffect(() => {
    if (previousPresentationSessionKey.current !== presentationSessionKey) {
      previousPresentationSessionKey.current = presentationSessionKey;
      presentation.reset();
    }
  }, [presentation, presentationSessionKey]);
  const [actionError, setActionError] = useState<{
    gameId: string;
    revision: number;
    message: string;
  } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);

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
        updateScreen((current) =>
          current.status === 'lobby' &&
          current.gameId === gameId &&
          current.playerToken === playerToken
            ? { ...current, view: message.view }
            : current,
        );
      },
      onGameUpdated(message) {
        const current = readScreen();
        if (
          (current.status !== 'lobby' && current.status !== 'playing') ||
          current.gameId !== gameId ||
          current.playerToken !== playerToken
        ) {
          return;
        }
        if (current.status === 'lobby') {
          gameStarted(gameId, playerToken, message.view, message.revision);
          return;
        }
        if (message.revision <= current.revision) {
          if (current.connection !== 'live')
            updateScreen(() => ({ ...current, connection: 'live' }));
          return;
        }
        const prepared = presentation.prepare(message.events, current.playerId);
        flushSync(() => {
          updateScreen(() => ({
            ...current,
            revision: message.revision,
            view: message.view,
            connection: 'live',
            awaitingUpdate: false,
          }));
        });
        presentation.enqueue(prepared);
      },
      onDisconnected() {
        updateScreen((current) =>
          current.status === 'playing' &&
          current.gameId === gameId &&
          current.playerToken === playerToken
            ? { ...current, connection: 'connecting' }
            : current,
        );
      },
    });
  }, [gameId, playerToken, presentation, readScreen, updateScreen, gameStarted]);

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
      updateScreen((current) =>
        current.status === 'playing' &&
        current.gameId === screen.gameId &&
        current.playerToken === screen.playerToken &&
        current.revision <= screen.revision
          ? { ...current, awaitingUpdate: true }
          : current,
      );
    } catch (error) {
      setActionError({
        gameId: screen.gameId,
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
      updateScreen((current) =>
        current.status === 'playing' &&
        current.gameId === screen.gameId &&
        current.playerToken === screen.playerToken &&
        current.revision <= screen.revision
          ? { ...current, awaitingUpdate: true }
          : current,
      );
    } catch (error) {
      setActionError({
        gameId: screen.gameId,
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
        actionError={
          actionError?.gameId === screen.gameId && actionError.revision === screen.revision
            ? actionError.message
            : null
        }
        onAction={sendAction}
        onNewGame={() => void session.startSolo()}
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
        pending={screen.start.status === 'pending'}
        error={screen.start.status === 'error' ? screen.start.message : null}
        onStart={session.startCoop}
      />
    );
  }

  return (
    <EntryScreen
      loading={screen.status === 'loading'}
      error={screen.status === 'error' ? screen.message : null}
      onCreateCoop={session.createCoop}
      onJoinCoop={session.joinCoop}
      onStartSolo={session.startSolo}
    />
  );
}

export default App;
