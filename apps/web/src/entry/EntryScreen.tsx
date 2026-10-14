import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button.tsx';

export function EntryScreen({
  loading,
  error,
  onCreateCoop,
  onJoinCoop,
  onStartSolo,
  onOpenAiSettings,
  aiSummary,
  aiConfigured,
}: {
  loading: boolean;
  error: string | null;
  onCreateCoop: () => void;
  onJoinCoop: (gameId: string) => void;
  onStartSolo: () => void;
  onOpenAiSettings: () => void;
  aiSummary: string | null;
  aiConfigured: boolean;
}) {
  const [joinId, setJoinId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = joinId.trim();
    if (!id) {
      setJoinError('Enter a game ID to join.');
      return;
    }
    setJoinError(null);
    onJoinCoop(id);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        <div className="mt-8 flex flex-col gap-4">
          <Button
            onClick={() => {
              setJoinError(null);
              onStartSolo();
            }}
            disabled={loading}
            className="min-h-11 w-full"
          >
            Start Solo Game
          </Button>
          <Button
            onClick={() => {
              setJoinError(null);
              onCreateCoop();
            }}
            disabled={loading}
            className="min-h-11 w-full"
          >
            Create Co-op Game
          </Button>
          <form onSubmit={join} className="mt-2 flex flex-col gap-3 border-t border-border pt-6">
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
              className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
            />
            <Button type="submit" className="min-h-11 w-full" disabled={loading}>
              Join Game
            </Button>
          </form>
        </div>
        <section className="mt-8 border-t border-border pt-6" aria-label="AI Settings">
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {aiSummary ?? 'Configure AI teammates before creating a co-op game.'}
          </p>
          <Button className="mt-4 min-h-11 w-full" onClick={onOpenAiSettings} disabled={loading}>
            {aiConfigured ? 'AI Settings' : 'Configure AI'}
          </Button>
        </section>
        {loading && (
          <p role="status" className="mt-5 text-sm">
            Loading game...
          </p>
        )}
        {(joinError || error) && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {joinError || error}
          </p>
        )}
      </div>
    </main>
  );
}
