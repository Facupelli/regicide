import { useState, type FormEvent } from 'react';
import * as v from 'valibot';
import { PLAYER_NAME_MAX_LENGTH, PlayerNameSchema } from '@regicide/protocol';
import { Button } from '../ui/Button.tsx';

export function InvitationScreen({
  error,
  onBack,
  onJoin,
  onResume,
  onRetry,
  pending = false,
  message = 'Joining game...',
}: {
  error: string | null;
  onBack: () => void;
  onJoin?: ((name: string) => void) | undefined;
  onResume?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  pending?: boolean;
  message?: string | undefined;
}) {
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState(false);

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = v.safeParse(PlayerNameSchema, nickname);
    if (!result.success) {
      setNicknameError(true);
      return;
    }
    setNicknameError(false);
    onJoin?.(result.output);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold">Regicide</h1>
        {onJoin && (
          <>
            <h2 className="mt-6 text-lg font-semibold">Join invited game</h2>
            {onResume && (
              <p className="mt-2 text-sm text-muted-foreground">
                Joining this invitation will replace the saved game in this tab.
              </p>
            )}
            <form onSubmit={join} className="mt-4">
              <label htmlFor="invitation-nickname" className="block text-sm font-medium">
                Your nickname
              </label>
              <input
                id="invitation-nickname"
                type="text"
                autoComplete="nickname"
                maxLength={PLAYER_NAME_MAX_LENGTH}
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  setNicknameError(false);
                }}
                disabled={pending}
                aria-invalid={nicknameError}
                aria-describedby={nicknameError ? 'invitation-nickname-error' : undefined}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
              />
              {nicknameError && (
                <p id="invitation-nickname-error" role="alert" className="mt-2 text-sm text-danger">
                  Enter a nickname of 1 to {PLAYER_NAME_MAX_LENGTH} characters without control
                  characters.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="mt-4 min-h-11 w-full">
                {pending ? 'Joining game...' : 'Join invited game'}
              </Button>
            </form>
            <Button className="mt-3 min-h-11 w-full" onClick={onBack} disabled={pending}>
              {onResume ? 'Resume current game' : 'Back to home'}
            </Button>
          </>
        )}
        {!onJoin && error && (
          <>
            <p role="alert" className="mt-6 text-sm text-danger">
              {error}
            </p>
            {onRetry && (
              <Button className="mt-6 min-h-11 w-full" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button className="mt-3 min-h-11 w-full" onClick={onBack}>
              {onResume ? 'Resume current game' : 'Back to home'}
            </Button>
          </>
        )}
        {!onJoin && !error && (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
