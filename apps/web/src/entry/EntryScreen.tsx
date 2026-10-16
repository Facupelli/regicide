import { useState } from 'react';
import * as v from 'valibot';
import { PLAYER_NAME_MAX_LENGTH, PlayerNameSchema } from '@regicide/protocol';
import { Button } from '../ui/Button.tsx';

export function EntryScreen({
  loading,
  error,
  onCreateCoop,
  onStartSolo,
  onOpenAiSettings,
  aiSummary,
  aiConfigured,
}: {
  loading: boolean;
  error: string | null;
  onCreateCoop: (name: string) => void;
  onStartSolo: (name: string) => void;
  onOpenAiSettings: () => void;
  aiSummary: string | null;
  aiConfigured: boolean;
}) {
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState(false);

  function start(action: (name: string) => void) {
    const result = v.safeParse(PlayerNameSchema, nickname);
    if (!result.success) {
      setNicknameError(true);
      return;
    }
    setNicknameError(false);
    action(result.output);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        <div className="mt-8">
          <label htmlFor="player-nickname" className="block text-sm font-medium">
            Your nickname
          </label>
          <input
            id="player-nickname"
            type="text"
            autoComplete="nickname"
            maxLength={PLAYER_NAME_MAX_LENGTH}
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setNicknameError(false);
            }}
            disabled={loading}
            aria-invalid={nicknameError}
            aria-describedby={nicknameError ? 'nickname-error' : undefined}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
          />
          {nicknameError && (
            <p id="nickname-error" role="alert" className="mt-2 text-sm text-danger">
              Enter a nickname of 1 to {PLAYER_NAME_MAX_LENGTH} characters without control
              characters.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-4">
            <Button
              onClick={() => start(onStartSolo)}
              disabled={loading}
              className="min-h-11 w-full"
            >
              Start Solo Game
            </Button>
            <Button
              onClick={() => start(onCreateCoop)}
              disabled={loading}
              className="min-h-11 w-full"
            >
              Create Co-op Game
            </Button>
          </div>
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
        {error && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
