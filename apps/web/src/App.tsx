import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GameView, LobbyView, PlayerCommand } from '@regicide/protocol';
import { connectGameSocket } from './api/game-socket.ts';
import {
  ApiClientError,
  createGame,
  createSoloGame,
  joinGame,
  startGame,
  submitAction,
} from './api/games.ts';
import { GameTable } from './components/game/GameTable.tsx';
import { LobbyScreen } from './components/lobby/LobbyScreen.tsx';
import { Button } from './components/ui/Button.tsx';

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
    } & Identity)
  | { status: 'error'; message: string };

type Selection = { revision: number; ids: string[] };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });
  const [joinId, setJoinId] = useState('');
  const [lobbyPending, setLobbyPending] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ revision: -1, ids: [] });
  const [actionError, setActionError] = useState<{ revision: number; message: string } | null>(
    null,
  );
  const [actionPending, setActionPending] = useState(false);
  const operationInFlight = useRef(false);
  const actionInFlight = useRef(false);

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
        setScreen((current) => {
          if (
            (current.status !== 'lobby' && current.status !== 'playing') ||
            current.gameId !== gameId ||
            current.playerToken !== playerToken
          ) {
            return current;
          }
          if (current.status === 'lobby') {
            return {
              ...playing(current, message.view),
              revision: message.revision,
              connection: 'live',
            };
          }
          if (message.revision <= current.revision) {
            return current.connection === 'live' ? current : { ...current, connection: 'live' };
          }
          return {
            ...current,
            revision: message.revision,
            view: message.view,
            connection: 'live',
            awaitingUpdate: false,
          };
        });
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
  }, [gameId, playerToken]);

  function playing(identity: Identity, view: GameView): ScreenState {
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
    };
  }

  async function createCoop() {
    if (operationInFlight.current || actionInFlight.current) return;
    operationInFlight.current = true;
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

  async function joinCoop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operationInFlight.current || actionInFlight.current) return;
    const id = joinId.trim();
    if (!id) {
      setScreen({ status: 'error', message: 'Enter a game ID to join.' });
      return;
    }
    operationInFlight.current = true;
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

  async function startSolo() {
    if (operationInFlight.current || actionInFlight.current) return;
    operationInFlight.current = true;
    setScreen({ status: 'loading' });
    setSelection({ revision: -1, ids: [] });
    setActionError(null);
    try {
      const response = await createSoloGame();
      setScreen(playing(response, response.view));
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not start a game') });
    } finally {
      operationInFlight.current = false;
    }
  }

  async function startCoop() {
    if (
      screen.status !== 'lobby' ||
      screen.view.hostPlayerId !== screen.playerId ||
      operationInFlight.current
    )
      return;
    operationInFlight.current = true;
    setLobbyPending(true);
    setLobbyError(null);
    try {
      // The socket publishes the authoritative view to every player, including the host.
      await startGame(screen.gameId, screen.playerToken);
    } catch (error) {
      setLobbyError(errorMessage(error, 'Could not start the game'));
    } finally {
      operationInFlight.current = false;
      setLobbyPending(false);
    }
  }

  const selectedCardIds =
    screen.status === 'playing' && selection.revision === screen.revision ? selection.ids : [];

  function toggleCard(cardId: string) {
    if (
      screen.status !== 'playing' ||
      screen.connection !== 'live' ||
      screen.awaitingUpdate ||
      actionInFlight.current
    )
      return;
    setSelection((current) => {
      const ids = current.revision === screen.revision ? current.ids : [];
      return {
        revision: screen.revision,
        ids: ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId],
      };
    });
  }

  async function sendAction(command: PlayerCommand) {
    if (
      screen.status !== 'playing' ||
      screen.view.status !== 'active' ||
      screen.connection !== 'live' ||
      screen.awaitingUpdate ||
      actionInFlight.current
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
      setSelection({ revision: -1, ids: [] });
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

  if (screen.status === 'playing') {
    const syncMessage =
      screen.connection === 'connecting'
        ? 'Connecting to live game...'
        : screen.awaitingUpdate
          ? 'Waiting for game update...'
          : null;
    return (
      <main className="min-h-svh bg-table font-sans lg:min-h-dvh">
        {syncMessage && (
          <p role="status" className="bg-panel px-4 py-2 text-center text-sm text-foreground">
            {syncMessage}
          </p>
        )}
        <GameTable
          view={screen.view}
          selectedCardIds={selectedCardIds}
          onToggleCard={toggleCard}
          onAction={sendAction}
          onNewGame={startSolo}
          actionPending={actionPending}
          actionsDisabled={screen.connection !== 'live' || screen.awaitingUpdate}
          actionError={actionError?.revision === screen.revision ? actionError.message : null}
        />
      </main>
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
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 font-sans text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Take on the castle together, or play solo.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <Button onClick={startSolo} disabled={screen.status === 'loading'}>
            Start Solo Game
          </Button>
          <Button onClick={createCoop} disabled={screen.status === 'loading'}>
            Create Co-op Game
          </Button>
          <form
            onSubmit={joinCoop}
            className="mt-2 flex flex-col gap-3 border-t border-border pt-6"
          >
            <label htmlFor="game-id" className="font-medium">
              Join a game
            </label>
            <input
              id="game-id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={joinId}
              onChange={(event) => setJoinId(event.target.value)}
              placeholder="Paste game ID"
              className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
            />
            <Button type="submit" disabled={screen.status === 'loading'}>
              Join Game
            </Button>
          </form>
        </div>
        {screen.status === 'loading' && (
          <p role="status" className="mt-5 text-sm">
            Loading game...
          </p>
        )}
        {screen.status === 'error' && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {screen.message}
          </p>
        )}
      </div>
    </main>
  );
}

export default App;
