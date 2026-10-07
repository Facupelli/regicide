import { useState } from 'react';
import type { LobbyView } from '@regicide/protocol';
import { Button } from '../ui/Button.tsx';

export function LobbyScreen({
  gameId,
  playerId,
  view,
  pending,
  error,
  onStart,
}: {
  gameId: string;
  playerId: string;
  view: LobbyView;
  pending: boolean;
  error: string | null;
  onStart: (scenario?: string) => void;
}) {
  const [scenario, setScenario] = useState('');
  const isHost = view.hostPlayerId === playerId;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-xl sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-card-selected">
          Co-op game
        </p>
        <h1 className="mt-2 text-3xl font-bold">Game lobby</h1>
        <p className="mt-6 text-sm text-muted-foreground">
          Share this game ID with the other players:
        </p>
        <p
          className="mt-2 break-all rounded-lg border border-border bg-background p-3 font-mono text-sm"
          aria-label="Game ID"
        >
          {gameId}
        </p>
        <h2 className="mt-6 text-lg font-semibold">Players ({view.players.length}/4)</h2>
        <ul className="mt-3 space-y-2">
          {view.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate" title={player.id}>
                {player.id === playerId ? 'You' : `Player ${player.id.slice(0, 8)}`}
              </span>
              {player.id === view.hostPlayerId && (
                <span className="shrink-0 text-card-selected">Host</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isHost ? (
            <div className="flex w-full flex-col gap-3">
              {import.meta.env.DEV && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="coop-scenario" className="font-medium">
                    Scenario
                  </label>
                  <select
                    id="coop-scenario"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value)}
                    disabled={pending}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
                  >
                    <option value="">Normal game</option>
                    <option value="enemy-defeat-exact-vs-overkill">
                      Enemy defeat - exact vs overkill
                    </option>
                  </select>
                </div>
              )}
              <Button
                className="self-start"
                disabled={pending}
                onClick={() => onStart(import.meta.env.DEV && scenario ? scenario : undefined)}
              >
                {pending ? 'Please wait...' : 'Start game'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the host to start.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
