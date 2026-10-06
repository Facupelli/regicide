import { useRef, useState } from 'react';
import type { GameView, PlayerCommand } from '@regicide/protocol';
import { ApiClientError, createGame, submitAction } from './api/games.ts';
import { GameTable } from './components/game/GameTable.tsx';
import { Button } from './components/ui/Button.tsx';

type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; gameId: string; view: GameView }
  | { status: 'error'; message: string };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code}, HTTP ${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const [screen, setScreen] = useState<ScreenState>({ status: 'idle' });
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const actionInFlight = useRef(false);

  async function startGame() {
    if (screen.status === 'loading' || actionInFlight.current) return;
    setSelectedCardIds([]);
    setActionError(null);
    setScreen({ status: 'loading' });
    try {
      const response = await createGame();
      setScreen({ status: 'loaded', ...response });
    } catch (error) {
      setScreen({ status: 'error', message: errorMessage(error, 'Could not start a game') });
    }
  }

  function toggleCard(cardId: string) {
    if (actionInFlight.current) return;
    setSelectedCardIds((ids) =>
      ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId],
    );
  }

  async function sendAction(command: PlayerCommand) {
    if (screen.status !== 'loaded' || screen.view.status !== 'active' || actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    setActionPending(true);
    setActionError(null);
    try {
      const response = await submitAction(screen.gameId, command);
      setScreen({ status: 'loaded', ...response });
      setSelectedCardIds([]);
    } catch (error) {
      setActionError(errorMessage(error, 'Could not submit action'));
    } finally {
      actionInFlight.current = false;
      setActionPending(false);
    }
  }

  return screen.status === 'loaded' ? (
    <main className="min-h-dvh bg-table font-sans">
      <GameTable
        view={screen.view}
        selectedCardIds={selectedCardIds}
        onToggleCard={toggleCard}
        onAction={sendAction}
        onNewGame={startGame}
        actionPending={actionPending}
        actionError={actionError}
      />
    </main>
  ) : (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background p-4 font-sans text-foreground">
      <h1 className="text-3xl font-bold">Regicide</h1>
      <Button onClick={startGame} disabled={screen.status === 'loading'}>
        {screen.status === 'loading' ? 'Starting game...' : 'Start Solo Game'}
      </Button>
      {screen.status === 'error' && (
        <p role="alert" className="text-danger">
          {screen.message}
        </p>
      )}
    </main>
  );
}

export default App;
